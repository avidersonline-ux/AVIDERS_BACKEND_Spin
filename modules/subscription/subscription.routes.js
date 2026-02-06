const express = require('express');
const router = express.Router();
const subscriptionService = require('./subscription.service');
const { verifyToken } = require('../../middleware/auth');

router.post('/reward', verifyToken, async (req, res) => {
  try {
    const { uid, planId, amount } = req.body;
    const transaction = await subscriptionService.creditSubscriptionReward(uid, planId, amount);
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/deduct', verifyToken, async (req, res) => {
  try {
    const { uid, planId, amount } = req.body;
    const transaction = await subscriptionService.deductSubscriptionFee(uid, planId, amount);
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
