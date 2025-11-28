// config/firebase.js
const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(
  __dirname,
  "firebaseAuth.json"
));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
