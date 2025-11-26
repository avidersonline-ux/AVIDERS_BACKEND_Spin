// backend/services/fcm.js
const admin = require('firebase-admin');
const { getTokens, pruneInvalid } = require('../data/fcmTokens');

let _init = false;
function ensureInit() {
  if (_init) return;
  const credPath = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!credPath) throw new Error('FIREBASE_ADMIN_CREDENTIALS not set');
  admin.initializeApp({
    credential: admin.credential.cert(require(require('path').resolve(credPath))),
  });
  _init = true;
}

async function sendToUser(userId, dataPayload) {
  ensureInit();
  const tokens = getTokens(userId);
  if (!tokens.length) return { successCount: 0, failureCount: 0 };

  const message = {
    tokens,
    data: dataPayload,     // we render on-device with flutter_local_notifications
    android: { priority: 'high', ttl: 3600 * 1000 },
    apns: { headers: { 'apns-priority': '10' } },
  };

  const res = await admin.messaging().sendEachForMulticast(message);

  // prune invalid tokens
  const invalid = [];
  res.responses.forEach((r, idx) => {
    if (!r.success) {
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token') {
        invalid.push(tokens[idx]);
      }
    }
  });
  if (invalid.length) pruneInvalid(userId, invalid);

  return res;
}

module.exports = { sendToUser };
