const express = require('express');
const router = express.Router();
const referralService = require('./referral.service');
const catchAsync = require('../../utils/catchAsync');

router.post('/bonus-sync', catchAsync(async (req, res) => {
  const { referrerUid, newUserUid, referralCode } = req.body;
  const result = await referralService.creditReferralBonus(referrerUid, newUserUid, referralCode);
  res.json({ success: true, ...result });
}));

module.exports = router;
