const express = require('express');
const fs = require('fs');
const path = require('path');
const verifyJwt = require('../middleware/verifyJwt'); // must set req.user
const router = express.Router();

const tokensFile = path.join(__dirname, '..', 'data', 'user_tokens.json');

// tiny JSON store
function readStore() {
  try { return JSON.parse(fs.readFileSync(tokensFile, 'utf8')); }
  catch { return {}; }
}
function writeStore(obj) {
  fs.writeFileSync(tokensFile, JSON.stringify(obj, null, 2));
}

router.post('/me/fcm-token', verifyJwt, (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'INVALID_TOKEN' });
  }
  // derive a stable key for the user
  const userKey = (req.user?.id || req.user?.email || req.user?.sub || '').toString();
  if (!userKey) return res.status(401).json({ error: 'NO_USER_IN_JWT' });

  const store = readStore();
  store[userKey] = { token, at: new Date().toISOString() };
  writeStore(store);

  return res.json({ ok: true });
});

module.exports = router;
