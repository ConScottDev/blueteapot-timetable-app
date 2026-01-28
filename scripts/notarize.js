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

// Best-effort detection of transient network/outage errors from notarytool output
function isTransientNotaryError(err) {
  const msg = String(err?.message || err || "");
  // -1009 "offline" is the one you hit; these are common transient flavors
  return (
    msg.includes("NSURLErrorDomain") ||
    msg.includes("Code=-1009") ||
    msg.includes("offline") ||
    msg.includes("timed out") ||
    msg.includes("ECONNRESET") ||
    msg.includes("EAI_AGAIN") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  );
}

async function withRetries(fn, { attempts = 5, baseDelayMs = 5000, label = "operation" } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      if (i > 1) console.log(`Retrying ${label} (${i}/${attempts})...`);
      return await fn();
    } catch (e) {
      lastErr = e;
      const transient = isTransientNotaryError(e);
      console.warn(`${label} failed (${i}/${attempts}). transient=${transient}`);
      console.warn(String(e?.message || e));

      if (!transient) break;
      const delay = baseDelayMs * Math.pow(2, i - 1); // exponential backoff
      await sleep(Math.min(delay, 120000)); // cap at 2 minutes
    }
  }
  throw lastErr;
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

  // Re-zip every time to avoid stale zips
  await withRetries(
    async () => {
      run("rm", ["-f", zipPath], { stdio: "inherit" });
      run("ditto", ["-c", "-k", "--keepParent", appPath, zipPath], { stdio: "inherit" });
    },
    { attempts: 3, baseDelayMs: 2000, label: "zip app (ditto)" }
  );

  // Store credentials (safe to run repeatedly)
  await withRetries(
    async () => {
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
    },
    { attempts: 3, baseDelayMs: 5000, label: "store notary credentials" }
  );

  // Submit WITHOUT --wait (avoid long hangs + better control over retry)
  const submitJson = await withRetries(
    async () => {
      const out = run("xcrun", [
        "notarytool",
        "submit",
        zipPath,
        "--keychain-profile",
        "AC_NOTARY",
        "--output-format",
        "json",
      ]);
      const j = safeJsonParse(out);
      if (!j?.id) {
        console.error("Could not parse submit response:\n", out);
        throw new Error("Notary submit did not return an id");
      }
      return j;
    },
    { attempts: 5, baseDelayMs: 5000, label: "notarytool submit" }
  );

  const id = submitJson.id;
  console.log("Submitted notarization id:", id);

  // Poll up to ~70 minutes with backoff:
  // - first 10 polls: every 30s (5 min)
  // - next 20 polls: every 60s (20 min)
  // - remaining 45 polls: every 90s (67.5 min total worst-case)
  const maxPolls = 75;
  let accepted = false;
  let lastStatus = null;

  for (let i = 1; i <= maxPolls; i++) {
    console.log(`Polling notarization status (${i}/${maxPolls})...`);

    const infoJson = await withRetries(
      async () => {
        const out = run("xcrun", [
          "notarytool",
          "info",
          id,
          "--keychain-profile",
          "AC_NOTARY",
          "--output-format",
          "json",
        ]);
        const j = safeJsonParse(out);
        if (!j) {
          // rare, but don't crash on non-json; treat as transient
          throw new Error(`Could not parse notarytool info JSON: ${out.slice(0, 500)}`);
        }
        return j;
      },
      { attempts: 6, baseDelayMs: 5000, label: "notarytool info" }
    );

    const status = infoJson.status;
    lastStatus = status;
    console.log("Notary status:", status);

    if (status === "Accepted") {
      accepted = true;
      console.log("✅ Notarization Accepted");
      break;
    }

    if (status === "Invalid") {
      console.error("❌ Notarization Invalid. Fetching log...");
      try {
        const logOut = run("xcrun", ["notarytool", "log", id, "--keychain-profile", "AC_NOTARY"]);
        console.error("\nNotarytool log:\n", logOut);
      } catch (e) {
        console.error("Failed to fetch notarytool log:", String(e?.message || e));
      }
      throw new Error("Notarization failed (Invalid)");
    }

    // Choose delay with backoff schedule
    let delayMs = 30000; // default 30s
    if (i > 10 && i <= 30) delayMs = 60000;
    if (i > 30) delayMs = 90000;

    await sleep(delayMs);
  }

  if (!accepted) {
    console.error(
      `❌ Notarization did not reach Accepted after ${maxPolls} polls. Last status=${lastStatus}`
    );
    // Best-effort log fetch (may not exist yet if still "In Progress")
    try {
      const logOut = run("xcrun", ["notarytool", "log", id, "--keychain-profile", "AC_NOTARY"]);
      console.error("\nNotarytool log:\n", logOut);
    } catch (e) {
      console.error("Log not available yet:", String(e?.message || e));
    }
    throw new Error("Notarization timed out");
  }

  // Staple + validate (with retries for occasional stapler flakiness)
  await withRetries(
    async () => {
      run("xcrun", ["stapler", "staple", "-v", appPath], { stdio: "inherit" });
    },
    { attempts: 5, baseDelayMs: 5000, label: "stapler staple" }
  );

  await withRetries(
    async () => {
      run("xcrun", ["stapler", "validate", "-v", appPath], { stdio: "inherit" });
    },
    { attempts: 3, baseDelayMs: 3000, label: "stapler validate" }
  );

  console.log("\n✅ Notarization accepted and ticket stapled.");
};
