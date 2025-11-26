// backend/data/fcmTokens.js
// Minimal token store (file-backed). Replace with DB later if you want.
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'fcmTokens.json');

function _load() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return {}; }
}
function _save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

module.exports = {
  saveToken(userId, token) {
    const db = _load();
    db[userId] = db[userId] || [];
    if (!db[userId].includes(token)) db[userId].push(token);
    _save(db);
  },
  removeToken(userId, token) {
    const db = _load();
    if (!db[userId]) return;
    db[userId] = db[userId].filter(t => t !== token);
    _save(db);
  },
  getTokens(userId) {
    const db = _load();
    return db[userId] || [];
  },
  getAll() { return _load(); },
  pruneInvalid(userId, invalidTokens) {
    const db = _load();
    if (!db[userId]) return;
    const bad = new Set(invalidTokens);
    db[userId] = db[userId].filter(t => !bad.has(t));
    _save(db);
  }
};
