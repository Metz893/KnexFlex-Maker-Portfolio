const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.log("Usage: node scripts/makeAdmin.js <UID>");
    process.exit(1);
  }

  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log("✅ admin:true set for", uid);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});