/* eslint-disable no-console */
const { execFileSync } = require("child_process");
const path = require("path");

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, { encoding: "utf8", ...opts });
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

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const zipPath = path.join(appOutDir, `${appName}.zip`);

  const { APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD } = process.env;
  if (!APPLE_ID || !APPLE_TEAM_ID || !APPLE_APP_SPECIFIC_PASSWORD) {
    console.warn("Skipping notarization: missing APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD");
    return;
  }

  console.log("Notarizing app at:", appPath);

  // Zip the .app for notarization
  run("ditto", ["-c", "-k", "--keepParent", appPath, zipPath], { stdio: "inherit" });

  // Store credentials (profile name AC_NOTARY)
  run(
    "xcrun",
    [
      "notarytool",
      "store-credentials",
      "AC_NOTARY",
      "--apple-id",
      APPLE_ID,
      "--team-id",
      APPLE_TEAM_ID,
      "--password",
      APPLE_APP_SPECIFIC_PASSWORD,
    ],
    { stdio: "inherit" }
  );

  // Submit WITHOUT --wait
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

  // Poll status up to ~60 minutes, tolerate transient network errors
  const maxPolls = 120; // 120 * 30s = 60 min
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
      // network hiccup / temporary Apple outage
      console.warn("notarytool info failed (will retry):", e?.message || e);
      await sleep(30000);
      continue;
    }

    const infoJson = safeJsonParse(infoOut);
    const status = infoJson?.status;

    console.log("Notary status:", status);

    if (status === "Accepted") {
      console.log("✅ Notarization Accepted");
      break;
    }

    if (status === "Invalid") {
      console.error("❌ Notarization Invalid. Fetching log...");
      try {
        const logOut = run("xcrun", ["notarytool", "log", id, "--keychain-profile", "AC_NOTARY"]);
        console.error("\nNotarytool log:\n", logOut);
      } catch (e) {
        console.error("Failed to fetch notarytool log:", e?.message || e);
      }
      throw new Error("Notarization failed (Invalid)");
    }

    await sleep(30000);
  }

  // Staple + validate
  run("xcrun", ["stapler", "staple", "-v", appPath], { stdio: "inherit" });
  run("xcrun", ["stapler", "validate", "-v", appPath], { stdio: "inherit" });

  console.log("\n✅ Notarization accepted and ticket stapled.");
};
