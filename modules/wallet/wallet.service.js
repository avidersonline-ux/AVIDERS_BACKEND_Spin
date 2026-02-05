const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');
const { CREDIT, DEBIT, SOURCES } = require('./transaction.types');
const mongoose = require('mongoose');

class WalletService {
  /**
   * Get or create wallet for a user
   */
  async getWallet(userId) {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId });
    }
    return wallet;
  }

  /**
   * Credit amount to wallet
   * @param {string} userId
   * @param {number} amount
   * @param {string} source - One of transaction.types.SOURCES
   * @param {string} referenceId - Unique ID for idempotency (e.g. spinHistoryId)
   * @param {object} metadata - Extra info
   * @param {boolean} skipUserSync - If true, doesn't update User.walletCoins (use for mirroring existing logic)
   */
  async credit(userId, amount, source, referenceId, metadata = {}, skipUserSync = false) {
    if (amount <= 0) return null;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Idempotency Check
      const existingTx = await Transaction.findOne({ referenceId }).session(session);
      if (existingTx) {
        await session.abortTransaction();
        session.endSession();
        return existingTx;
      }

      // 2. Update Wallet Model
      const wallet = await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: {
            unlockedBalance: amount,
            totalEarned: amount,
            [`breakdown.${source.toLowerCase()}`]: amount
          }
        },
        { upsert: true, new: true, session }
      );

      // 3. Sync to User Model (Primary Source) if not skipped
      // We do this for new sources (Cashback, Sub, Manual) but skip for Spin/Referral if already handled in server.js
      if (!skipUserSync) {
        await mongoose.model('User').findOneAndUpdate(
          { uid: userId },
          { $inc: { walletCoins: amount } },
          { session }
        );
      }

      // 4. Create Transaction Record
      const transaction = await Transaction.create([{
        userId,
        type: CREDIT,
        source,
        amount,
        balanceAfter: wallet.unlockedBalance,
        referenceId,
        metadata,
        status: 'completed'
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return transaction[0];
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error(`[WalletService] Credit failed for ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Debit amount from wallet (Spend)
   */
  async debit(userId, amount, source, referenceId, metadata = {}) {
    if (amount <= 0) throw new Error('Invalid amount');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Idempotency Check
      const existingTx = await Transaction.findOne({ referenceId }).session(session);
      if (existingTx) {
        await session.abortTransaction();
        session.endSession();
        return existingTx;
      }

      // 2. Update Wallet Model (Ensure balance)
      const wallet = await Wallet.findOneAndUpdate(
        { userId, unlockedBalance: { $gte: amount } },
        {
          $inc: {
            unlockedBalance: -amount,
            totalSpent: amount
          }
        },
        { new: true, session }
      );

      if (!wallet) {
        throw new Error('Insufficient wallet balance');
      }

      // 3. Sync to User Model (Primary Source)
      // Always sync debit to keep the app balance correct
      await mongoose.model('User').findOneAndUpdate(
        { uid: userId },
        { $inc: { walletCoins: -amount } },
        { session }
      );

      // 4. Create Transaction Record
      const transaction = await Transaction.create([{
        userId,
        type: DEBIT,
        source,
        amount,
        balanceAfter: wallet.unlockedBalance,
        referenceId,
        metadata,
        status: 'completed'
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return transaction[0];
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error(`[WalletService] Debit failed for ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Admin adjustment
   */
  async adminAdjust(userId, amount, type, reason) {
    const referenceId = `admin_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    if (type === CREDIT) {
      return this.credit(userId, amount, SOURCES.MANUAL, referenceId, { reason, adminAction: true }, false);
    } else {
      return this.debit(userId, amount, SOURCES.MANUAL, referenceId, { reason, adminAction: true });
    }
  }
}

module.exports = new WalletService();

