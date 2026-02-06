const express = require('express');
const router = express.Router();
const scanpayService = require('./scanpay.service');

router.post('/pay', async (req, res) => {
  try {
    const { uid, merchantId, amount, transactionId } = req.body;
    const transaction = await scanpayService.processScanAndPay(uid, merchantId, amount, transactionId);
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
