const express = require('express');
const router = express.Router();
const cashbackService = require('./cashback.service');
const { verifyToken } = require('../../middleware/auth');

router.post('/process', verifyToken, async (req, res) => {
  try {
    const { uid, orderId, amount } = req.body;
    const transaction = await cashbackService.processProductPurchase(uid, orderId, amount);
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
