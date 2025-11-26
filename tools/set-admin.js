// tools/set-admin.js
// Usage: node tools/set-admin.js you@domain.com
const admin = require("firebase-admin");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your serviceAccount.json");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

(async () => {
  try {
    const email = process.argv[2];
    if (!email) throw new Error("Usage: node tools/set-admin.js <email>");

    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true,
      staff: false,
      actor: false,
      student: false,
    });
    console.log("✅ Set admin claim for:", email, "uid:", user.uid);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
