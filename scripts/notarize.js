/* eslint-disable no-console */
const { execFileSync } = require("child_process");
const path = require("path");

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, { encoding: "utf8", ...opts });
}

function runInherit(cmd, args) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit" });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function isProbablyNetworkError(err) {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("NSURLErrorDomain") ||
    msg.includes("The Internet connection appears to be offline") ||
    msg.includes("timed out") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("EAI_AGAIN")
  );
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const zipPath = path.join(appOutDir, `${appName}.zip`);

  const { APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD } = process.env;
  if (!APPLE_ID || !APPLE_TEAM_ID || !APPLE_APP_SPECIFIC_PASSWORD) {
    console.warn(
      "Skipping notarization: missing APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD"
    );
    return;
  }

  console.log("Notarizing app at:", appPath);

  // Recreate zip (avoid stale zip from previous run)
  runInherit("rm", ["-f", zipPath]);
  runInherit("ditto", ["-c", "-k", "--keepParent", appPath, zipPath]);

  // Store credentials (idempotent — OK to run every time)
  runInherit("xcrun", [
    "notarytool",
    "store-credentials",
    "AC_NOTARY",
    "--apple-id",
    APPLE_ID,
    "--team-id",
    APPLE_TEAM_ID,
    "--password",
    APPLE_APP_SPECIFIC_PASSWORD,
  ]);

  // Submit WITHOUT --wait (we handle waiting ourselves to survive network hiccups)
  const submitOut = run("xcrun", [
    "notarytool",
    "submit",
    zipPath,
    "--keychain-profile",
    "AC_NOTARY",
    "--output-format",
    "json",
  ]);

  const submitJson = safeJsonParse(submitOut);
  const id = submitJson?.id;
  if (!id) {
    console.error("Could not parse submit response:\n", submitOut);
    throw new Error("Notary submit did not return an id");
  }

  console.log("Submitted notarization id:", id);

  // Polling strategy:
  // - 75 polls
  // - 60s interval => ~75 minutes max
  // - tolerates transient network errors (doesn't reset the timer)
  const maxPolls = Number(process.env.NOTARY_MAX_POLLS || 75);
  const intervalMs = Number(process.env.NOTARY_POLL_INTERVAL_MS || 60000);

  let accepted = false;

  for (let i = 1; i <= maxPolls; i++) {
    console.log(`Polling notarization status (${i}/${maxPolls})...`);

    let infoOut = "";
    try {
      infoOut = run("xcrun", [
        "notarytool",
        "info",
        id,
        "--keychain-profile",
        "AC_NOTARY",
        "--output-format",
        "json",
      ]);
    } catch (e) {
      if (isProbablyNetworkError(e)) {
        console.warn("notarytool info failed (network hiccup; will retry):", e?.message || e);
        await sleep(intervalMs);
        continue;
      }
      throw e;
    }

    const infoJson = safeJsonParse(infoOut);
    const status = infoJson?.status;
    console.log("Notary status:", status);

    if (status === "Accepted") {
      accepted = true;
      console.log("✅ Notarization Accepted");
      break;
    }

    if (status === "Invalid") {
      console.error("❌ Notarization Invalid. Fetching log...");
      try {
        const logOut = run("xcrun", [
          "notarytool",
          "log",
          id,
          "--keychain-profile",
          "AC_NOTARY",
        ]);
        console.error("\nNotarytool log:\n", logOut);
      } catch (e) {
        console.error("Failed to fetch notarytool log:", e?.message || e);
      }
      throw new Error(`Notarization failed (Invalid). Submission id: ${id}`);
    }

    // In Progress / Submitted / etc.
    await sleep(intervalMs);
  }

  // IMPORTANT: do NOT staple unless Accepted
  if (!accepted) {
    throw new Error(
      `Notarization did not finish within the polling window (still not Accepted/Invalid). ` +
        `Submission id: ${id}. You can inspect it later with: ` +
        `xcrun notarytool info ${id} --keychain-profile AC_NOTARY --output-format json`
    );
  }

  // Staple + validate
  runInherit("xcrun", ["stapler", "staple", "-v", appPath]);
  runInherit("xcrun", ["stapler", "validate", "-v", appPath]);

  console.log("\n✅ Notarization accepted and ticket stapled.");
};
