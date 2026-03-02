// helpers/fcmHelper.js
const admin = require("firebase-admin");

const sendFirebaseNotification = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) return;

  const message = {
    token: fcmToken,
    notification: { title, body },
    data, 
  };

  try {
    await admin.messaging().send(message);
    console.log("Firebase notification sent");
  } catch (err) {
    console.error("Firebase send error:", err);
  }
};

module.exports = { sendFirebaseNotification };
