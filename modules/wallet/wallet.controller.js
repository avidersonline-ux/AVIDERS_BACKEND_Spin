const walletService = require('./wallet.service');
const Transaction = require('../../models/Transaction');
const { AppError } = require('../../utils/errorHandler');
const { SOURCES, CREDIT } = require('./transaction.types');

class WalletController {
  async getBalance(req, res, next) {
    const { uid } = req.body;
    if (!uid) return next(new AppError('UID is required', 400));

    const wallet = await walletService.getWallet(uid);
    res.json({ success: true, wallet });
  }

  async getHistory(req, res, next) {
    const { uid } = req.body;
    if (!uid) return next(new AppError('UID is required', 400));

    const transactions = await Transaction.find({ userId: uid })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, transactions });
  }

  async spend(req, res, next) {
    const { uid, amount, referenceId, description } = req.body;
    if (!uid || !amount) return next(new AppError('UID and Amount are required', 400));

    const transaction = await walletService.debit(
      uid,
      amount,
      SOURCES.SPEND,
      referenceId || `spend_${Date.now()}`,
      { description }
    );

    res.json({ success: true, transaction });
  }

  async adminCredit(req, res, next) {
    const { uid, amount, reason } = req.body;
    if (!uid || !amount) return next(new AppError('UID and Amount are required', 400));

    const transaction = await walletService.adminAdjust(uid, amount, CREDIT, reason);
    res.json({ success: true, transaction });
  }
}

module.exports = new WalletController();

