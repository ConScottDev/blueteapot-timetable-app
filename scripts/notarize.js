/* eslint-disable no-console */
const { execFileSync } = require("child_process");
const path = require("path");

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, { encoding: "utf8", ...opts });
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const zipPath = path.join(appOutDir, `${appName}.zip`);

  if (!process.env.APPLE_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    console.warn("Skipping notarization: missing APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD");
    return;
  }

  console.log("Notarizing app at:", appPath);

  // Zip the .app for notarization
  run("ditto", ["-c", "-k", "--keepParent", appPath, zipPath], { stdio: "inherit" });

  // Store credentials once (profile name AC_NOTARY)
  run(
    "xcrun",
    [
      "notarytool",
      "store-credentials",
      "AC_NOTARY",
      "--apple-id",
      process.env.APPLE_ID,
      "--team-id",
      process.env.APPLE_TEAM_ID,
      "--password",
      process.env.APPLE_APP_SPECIFIC_PASSWORD,
    ],
    { stdio: "inherit" }
  );

  // Submit and WAIT for result (this is the critical part)
  const submitOut = run("xcrun", [
    "notarytool",
    "submit",
    zipPath,
    "--keychain-profile",
    "AC_NOTARY",
    "--wait",
    "--output-format",
    "json",
  ]);

  let result;
  try {
    result = JSON.parse(submitOut);
  } catch (e) {
    console.error("Could not parse notarytool JSON output:\n", submitOut);
    throw e;
  }

  const id = result.id;
  const status = result.status;

  console.log("\nNotarytool result:", { id, status });

  if (status !== "Accepted") {
    // Get log for troubleshooting and fail the build
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
      console.error("Failed to fetch notarytool log.");
    }
    throw new Error(`Notarization failed (status: ${status})`);
  }

  // Staple ticket to the .app
  run("xcrun", ["stapler", "staple", "-v", appPath], { stdio: "inherit" });

  // Optional: validate stapling
  run("xcrun", ["stapler", "validate", "-v", appPath], { stdio: "inherit" });

  console.log("\n✅ Notarization accepted and ticket stapled.");
};
