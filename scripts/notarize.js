/* eslint-disable no-console */
const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== "darwin") return;

  // IMPORTANT: appId must match your build.appId
  const appId = "ie.blueteapot.timetable";
  const appName = context.packager.appInfo.productFilename;

  const appPath = `${appOutDir}/${appName}.app`;

  console.log("Notarizing app at:", appPath);

  // Retries help with occasional Apple HTTP flakiness
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await notarize({
        appBundleId: appId,
        appPath,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
      });
      console.log("Notarization succeeded");
      return;
    } catch (err) {
      console.error(`Notarization attempt ${attempt} failed:`, err);
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 15000));
    }
  }
};
