const walletService = require('../wallet/wallet.service');
const { SOURCES } = require('../wallet/transaction.types');

class ScanPayService {
  /**
   * Process a payment made via QR scan at a merchant
   */
  async processScanAndPay(userId, merchantId, amount, transactionId) {
    // Deduct from wallet
    return await walletService.debit(
      userId,
      amount,
      SOURCES.SPEND,
      `scan_${transactionId}`,
      {
        merchantId,
        type: 'SCAN_PAY',
        description: `Payment to merchant ${merchantId}`
      }
    );
  }
}

module.exports = new ScanPayService();

