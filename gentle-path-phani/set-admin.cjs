const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const email = "abcd1234@gmail.com";

async function setAdmin() {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { role: "admin" });
  console.log(`Admin role set for ${email}`);
  process.exit(0);
}

setAdmin().catch(console.error);
