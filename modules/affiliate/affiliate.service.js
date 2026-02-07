const AffiliateClaim = require('../../models/AffiliateClaim');
const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');
const { AppError } = require('../../utils/errorHandler');
const mongoose = require('mongoose');
const { moveFileInR2 } = require('../../config/r2'); // ✅ Add this import

class AffiliateService {
  /**
   * Submit a new claim - 5% reward for affiliate purchases
   */
  async submitClaim(data) {
    const existing = await AffiliateClaim.findOne({ orderId: data.orderId });
    if (existing) throw new AppError('Order ID already submitted', 400);

    // ✅ Calculate Reward: 5% of order amount
    const rewardCoins = Math.floor(data.orderAmount * 0.05);

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

      // ✅ MOVE FILE: From pending to approved folder
      let newScreenshotUrl = claim.screenshotUrl;
      if (claim.screenshotUrl.includes('pending')) {
        const destinationKey = claim.screenshotUrl.replace('pending', 'approved');
        newScreenshotUrl = await moveFileInR2(
          this.extractKeyFromUrl(claim.screenshotUrl),
          this.extractKeyFromUrl(destinationKey)
        );
      }

      // Update claim
      claim.status = 'approved';
      claim.approvedAt = new Date();
      claim.adminNote = adminNote;
      claim.screenshotUrl = newScreenshotUrl;
      await claim.save({ session });

      // Lock coins in wallet
      const wallet = await Wallet.findOneAndUpdate(
        { userId: claim.userId },
        { $inc: { lockedBalance: claim.rewardCoins } },
        { upsert: true, new: true, session }
      );

      // Log transaction
      await Transaction.create([{
        userId: claim.userId,
        type: 'CREDIT',
        source: 'AFFILIATE',
        amount: claim.rewardCoins,
        balanceAfter: wallet.unlockedBalance,
        referenceId: `aff_appr_${claim._id}`,
        metadata: { 
          claimId: claim._id, 
          status: 'locked',
          maturityDays: claim.maturityDays
        },
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
   * ✅ Reject a claim with file moving
   */
  async rejectClaim(claimId, adminNote) {
    const claim = await AffiliateClaim.findById(claimId);
    if (!claim || claim.status !== 'pending') {
      throw new AppError('Invalid claim or already processed', 400);
    }
    
    // ✅ MOVE FILE: From pending to rejected folder
    let newScreenshotUrl = claim.screenshotUrl;
    if (claim.screenshotUrl.includes('pending')) {
      const destinationKey = claim.screenshotUrl.replace('pending', 'rejected');
      newScreenshotUrl = await moveFileInR2(
        this.extractKeyFromUrl(claim.screenshotUrl),
        this.extractKeyFromUrl(destinationKey)
      );
    }
    
    claim.status = 'rejected';
    claim.adminNote = adminNote;
    claim.screenshotUrl = newScreenshotUrl;
    return await claim.save();
  }

  /**
   * Maturity Engine (Cron Logic) - OPTIMIZED
   */
  async processMaturity() {
    const now = new Date();
    
    // ✅ Find only claims ready for maturity (optimized query)
    const claimsToMature = await AffiliateClaim.aggregate([
      {
        $match: {
          status: 'approved',
          approvedAt: { $exists: true }
        }
      },
      {
        $addFields: {
          maturityDate: {
            $dateAdd: {
              startDate: '$approvedAt',
              unit: 'day',
              amount: '$maturityDays'
            }
          }
        }
      },
      {
        $match: {
          maturityDate: { $lte: now }
        }
      }
    ]);

    let processedCount = 0;

    for (const claim of claimsToMature) {
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // Update claim status
        await AffiliateClaim.findByIdAndUpdate(
          claim._id,
          {
            status: 'matured',
            maturedAt: new Date()
          },
          { session }
        );

        // Transfer from locked to unlockedBalance
        const wallet = await Wallet.findOneAndUpdate(
          { userId: claim.userId },
          {
            $inc: {
              lockedBalance: -claim.rewardCoins,
              unlockedBalance: claim.rewardCoins
            }
          },
          { new: true, session }
        );

        // Update User model
        await mongoose.model('User').updateOne(
          { uid: claim.userId },
          { $inc: { walletCoins: claim.rewardCoins } },
          { session }
        );

        // Log maturity transaction
        await Transaction.create([{
          userId: claim.userId,
          type: 'CREDIT',
          source: 'AFFILIATE_MATURED',
          amount: claim.rewardCoins,
          balanceAfter: wallet.unlockedBalance,
          referenceId: `aff_matured_${claim._id}`,
          metadata: { 
            claimId: claim._id, 
            originalApprovalDate: claim.approvedAt 
          },
          status: 'completed'
        }], { session });

        await session.commitTransaction();
        processedCount++;
      } catch (err) {
        await session.abortTransaction();
        console.error(`Maturity failed for ${claim._id}:`, err.message);
      } finally {
        session.endSession();
      }
    }
    return processedCount;
  }

  /**
   * ✅ HELPER: Extract key from R2 URL
   */
  extractKeyFromUrl(url) {
    // URL format: https://account.r2.cloudflarestorage.com/bucket/key
    const parts = url.split('/');
    const bucketIndex = parts.indexOf(process.env.R2_BUCKET_NAME || "aviders-claims");
    if (bucketIndex !== -1) {
      return parts.slice(bucketIndex + 1).join('/');
    }
    // If it's already just the key, return as is
    return url;
  }
}

module.exports = new AffiliateService();
