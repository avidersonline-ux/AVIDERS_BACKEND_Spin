// backend/routes/notify.js
const express = require('express');
const router = express.Router();
const { saveToken } = require('../data/fcmTokens');
const { sendToUser } = require('../services/fcm');
const verifyJwt = require('../middleware/verifyJwt'); // you already have this

// 1) Client calls this after login / token refresh
router.post('/sync-token', verifyJwt, (req, res) => {
  const userId = req.user?.id || req.user?.email; // depends on your verifyJwt
  const { token } = req.body || {};
  if (!token || !userId) return res.status(400).json({ ok: false, error: 'missing token/user' });
  saveToken(userId, token);
  return res.json({ ok: true });
});

// 2) Send a bill reminder to the *current* authenticated user
router.post('/bill', verifyJwt, async (req, res) => {
  const userId = req.user?.id || req.user?.email;
  const { billId, title, body, payUrl } = req.body || {};
  if (!billId) return res.status(400).json({ ok: false, error: 'missing billId' });

  const data = {
    type: 'bill_reminder',
    billId: String(billId),
    title: title || 'Bill Reminder',
    body: body || '',
    payUrl: payUrl || '',
  };

  try {
    const resp = await sendToUser(userId, data);
    return res.json({ ok: true, results: resp });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// 3) (Optional) Admin endpoint to send to any user
router.post('/admin/bill', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_API_KEY) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const { userId, billId, title, body, payUrl } = req.body || {};
  if (!userId || !billId) return res.status(400).json({ ok: false, error: 'missing userId/billId' });

  const data = {
    type: 'bill_reminder',
    billId: String(billId),
    title: title || 'Bill Reminder',
    body: body || '',
    payUrl: payUrl || '',
  };

  try {
    const resp = await sendToUser(userId, data);
    return res.json({ ok: true, results: resp });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

module.exports = router;
