const express = require('express');
const router = express.Router();
const verifyJwt = require('../middleware/verifyJwt');
const { verifyHmacSignature } = require('../utils/hmac');

router.get('/ping', verifyJwt, (req, res) => res.json({ ok: true, user: req.user }));
router.post('/hmac-check', verifyJwt, (req, res) => {
  const sig = req.get('x-hmac-signature') || '';
  const raw = req.rawBody || JSON.stringify(req.body || {});
  const ok = verifyHmacSignature(raw, process.env.HMAC_SHARED_SECRET, sig);
  res.status(ok ? 200 : 401).json({ ok });
});
module.exports = router;
