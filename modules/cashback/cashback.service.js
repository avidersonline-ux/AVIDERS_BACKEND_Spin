const walletService = require('../wallet/wallet.service');
const { SOURCES } = require('../wallet/transaction.types');

class CashbackService {
  /**
   * Process cashback for a product purchase
   */
  async processProductPurchase(userId, orderId, purchaseAmount, cashbackPercentage = 5) {
    const cashbackAmount = Math.floor((purchaseAmount * cashbackPercentage) / 100);

    if (cashbackAmount > 0) {
      return await walletService.credit(
        userId,
        cashbackAmount,
        SOURCES.CASHBACK,
        `cb_${orderId}`,
        { orderId, purchaseAmount, cashbackPercentage }
      );
    }
    return null;
  }

  async getCashbackHistory(userId) {
    const Transaction = require('../../models/Transaction');
    return await Transaction.find({ userId, source: SOURCES.CASHBACK }).sort({ createdAt: -1 });
  }
}

module.exports = new CashbackService();

