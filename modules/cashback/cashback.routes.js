const express = require('express');
const router = express.Router();
const cashbackService = require('./cashback.service');

router.post('/process', async (req, res) => {
  try {
    const { uid, orderId, amount } = req.body;
    const transaction = await cashbackService.processProductPurchase(uid, orderId, amount);
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

