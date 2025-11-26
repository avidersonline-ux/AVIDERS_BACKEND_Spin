const express = require('express');
const router = express.Router();
const verifyJwt = require('../middleware/verifyJwt');
const { verifyHmacSignature } = require('../utils/hmac');

router.post('/data', verifyJwt, (req, res) => {
  const sig = req.get('x-hmac-signature') || '';
  const raw = req.rawBody || JSON.stringify(req.body || {});
  const ok = verifyHmacSignature(raw, process.env.HMAC_SHARED_SECRET, sig);
  if (!ok) return res.status(401).json({ error: 'Invalid HMAC' });
  res.json({ ok: true, user: req.user, body: req.body });
});
module.exports = router;
