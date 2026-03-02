require("dotenv").config(); // load .env
const admin = require("firebase-admin");

// Parse the JSON from the environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIAL);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
