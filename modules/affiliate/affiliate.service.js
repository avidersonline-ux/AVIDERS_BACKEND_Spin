const AffiliateClaim = require('../../models/AffiliateClaim');
const Wallet = require('../../models/Wallet');
const walletService = require('../wallet/wallet.service');
const { AppError } = require('../../utils/errorHandler');
const mongoose = require('mongoose');

class AffiliateService {
  /**
   * Submit a new claim
   */
  async submitClaim(data) {
    const existing = await AffiliateClaim.findOne({ orderId: data.orderId });
    if (existing) throw new AppError('Order ID already submitted', 400);

    // Calculate Reward (10% of order amount)
    const rewardCoins = Math.floor(data.orderAmount * 0.10);

    // Determine Maturity Days
    let maturityDays = 60; // Default External
    if (data.affiliateNetwork.toLowerCase().includes('subscription')) maturityDays = 30;
    if (data.affiliateNetwork.toLowerCase().includes('partner')) maturityDays = 6;

    const claim = await AffiliateClaim.create({
      userId: data.uid,
      orderId: data.orderId,
      productName: data.productName,
      orderAmount: data.orderAmount,
      rewardCoins,
      affiliateNetwork: data.affiliateNetwork,
      screenshotUrl: data.screenshotUrl,
      maturityDays,
      status: 'pending'
    });

    return claim;
  }

  /**
   * Admin Approval Logic
   */
  async approveClaim(claimId, adminNote) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const claim = await AffiliateClaim.findById(claimId).session(session);
      if (!claim || claim.status !== 'pending') {
        throw new AppError('Invalid claim or already processed', 400);
      }

      claim.status = 'approved';
      claim.approvedAt = new Date();
      claim.adminNote = adminNote;
      await claim.save({ session });

      // Lock coins in wallet
      await Wallet.findOneAndUpdate(
        { userId: claim.userId },
        { $inc: { lockedBalance: claim.rewardCoins } },
        { upsert: true, session }
      );

      // Log transaction
      const Transaction = require('../../models/Transaction');
      await Transaction.create([{
        userId: claim.userId,
        type: 'CREDIT',
        source: 'CASHBACK',
        amount: claim.rewardCoins,
        balanceAfter: 0, // Simplified as it's locked
        referenceId: `aff_appr_${claim._id}`,
        metadata: { claimId: claim._id, status: 'locked' },
        status: 'completed'
      }], { session });

      await session.commitTransaction();
      return claim;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Maturity Engine (Cron Logic)
   */
  async processMaturity() {
    const now = new Date();
    // Find approved claims where (approvedAt + maturityDays) <= now
    const approvedClaims = await AffiliateClaim.find({ status: 'approved' });

    let processedCount = 0;

    for (const claim of approvedClaims) {
      const maturityDate = new Date(claim.approvedAt);
      maturityDate.setDate(maturityDate.getDate() + claim.maturityDays);

      if (maturityDate <= now) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          claim.status = 'matured';
          claim.maturedAt = new Date();
          await claim.save({ session });

          // Transfer from locked to unlockedBalance
          await Wallet.findOneAndUpdate(
            { userId: claim.userId },
            {
              $inc: {
                lockedBalance: -claim.rewardCoins,
                unlockedBalance: claim.rewardCoins
              }
            },
            { session }
          );

          // Update User model (Primary for mobile app)
          await mongoose.model('User').updateOne(
            { uid: claim.userId },
            { $inc: { walletCoins: claim.rewardCoins } },
            { session }
          );

          await session.commitTransaction();
          processedCount++;
        } catch (err) {
          await session.abortTransaction();
          console.error(`Maturity failed for ${claim._id}:`, err.message);
        } finally {
          session.endSession();
        }
      }
    }
    return processedCount;
  }
}

module.exports = new AffiliateService();
