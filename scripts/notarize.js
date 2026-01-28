/* eslint-disable no-console */
const { execFileSync } = require("child_process");
const path = require("path");

function run(cmd, args) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, { stdio: "inherit" });
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") return;

  // App path
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log("Notarizing app at:", appPath);

  // Zip the .app (notarytool likes a zip)
  const zipPath = path.join(appOutDir, `${appName}.zip`);
  run("ditto", ["-c", "-k", "--keepParent", appPath, zipPath]);

  // Store credentials (profile name AC_NOTARY)
  run("xcrun", [
    "notarytool",
    "store-credentials",
    "AC_NOTARY",
    "--apple-id",
    process.env.APPLE_ID,
    "--team-id",
    process.env.APPLE_TEAM_ID,
    "--password",
    process.env.APPLE_APP_SPECIFIC_PASSWORD,
  ]);

  // Submit WITHOUT --wait (so CI doesn't hang for hours)
  // Output will include the submission id.
  run("xcrun", [
    "notarytool",
    "submit",
    zipPath,
    "--keychain-profile",
    "AC_NOTARY",
    "--output-format",
    "json",
  ]);

  console.log(
    "\nSubmitted for notarization (not waiting in CI). " +
      "You can check status later with notarytool history/log."
  );
};
