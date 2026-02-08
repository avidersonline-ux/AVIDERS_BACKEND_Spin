const AffiliateClaim = require('../../models/AffiliateClaim');
const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');
const { AppError } = require('../../utils/errorHandler');
const mongoose = require('mongoose');
const { moveFileInR2 } = require('../../config/r2');

class AffiliateService {
  /**
   * Submit a new claim
   * - Others: 100% AVD reward
   * - Bill Pay: 150 AVD flat reward
   */
  async submitClaim(data) {
    const existing = await AffiliateClaim.findOne({ orderId: data.orderId });
    if (existing) throw new AppError('Order ID already submitted', 400);

    // ✅ Calculate Reward Logic
    let rewardCoins;
    if (data.affiliateNetwork === 'Bill Pay') {
      rewardCoins = 150; // Flat 150 AVD for Recharges/Bill Pay
    } else {
      rewardCoins = Math.floor(data.orderAmount); // 100% for Amazon, Flipkart, AVIDERS, etc.
    }

    // Determine Maturity Days
    let maturityDays = 60;
    if (data.affiliateNetwork.toLowerCase().includes('subscription')) maturityDays = 30;
    if (data.affiliateNetwork.toLowerCase().includes('partner')) maturityDays = 6;
    if (data.affiliateNetwork === 'Bill Pay') maturityDays = 3; // Fast maturity for Bill Pay?

    const claim = await AffiliateClaim.create({
      userId: data.uid,
      orderId: data.orderId,
      productName: data.productName,
      orderAmount: data.orderAmount,
      rewardCoins,
      affiliateNetwork: data.affiliateNetwork,
      screenshotUrl: data.screenshotUrl || '',
      orderDate: data.orderDate,
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

      // ✅ SAFE MOVE FILE: Don't crash if file move fails
      let newScreenshotUrl = claim.screenshotUrl;
      if (claim.screenshotUrl && claim.screenshotUrl.includes('pending')) {
        try {
          const destinationKey = claim.screenshotUrl.replace('pending', 'approved');
          newScreenshotUrl = await moveFileInR2(
            this.extractKeyFromUrl(claim.screenshotUrl),
            this.extractKeyFromUrl(destinationKey)
          );
        } catch (fileError) {
          console.warn(`⚠️ Warning: Could not move file for claim ${claimId}:`, fileError.message);
        }
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
   * Reject a claim
   */
  async rejectClaim(claimId, adminNote) {
    const claim = await AffiliateClaim.findById(claimId);
    if (!claim || claim.status !== 'pending') {
      throw new AppError('Invalid claim or already processed', 400);
    }
    
    let newScreenshotUrl = claim.screenshotUrl;
    if (claim.screenshotUrl && claim.screenshotUrl.includes('pending')) {
      try {
        const destinationKey = claim.screenshotUrl.replace('pending', 'rejected');
        newScreenshotUrl = await moveFileInR2(
          this.extractKeyFromUrl(claim.screenshotUrl),
          this.extractKeyFromUrl(destinationKey)
        );
      } catch (fileError) {
        console.warn(`⚠️ Warning: Could not move file for rejection ${claimId}:`, fileError.message);
      }
    }
    
    claim.status = 'rejected';
    claim.adminNote = adminNote;
    claim.screenshotUrl = newScreenshotUrl;
    return await claim.save();
  }

  /**
   * Maturity Engine
   */
  async processMaturity() {
    const now = new Date();
    
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
        await AffiliateClaim.findByIdAndUpdate(
          claim._id,
          { status: 'matured', maturedAt: new Date() },
          { session }
        );

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

        await mongoose.model('User').updateOne(
          { uid: claim.userId },
          { $inc: { walletCoins: claim.rewardCoins } },
          { session }
        );

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

  extractKeyFromUrl(url) {
    if (!url) return '';
    const parts = url.split('/');
    const bucketName = process.env.R2_BUCKET_NAME || "aviders-claims";
    const bucketIndex = parts.indexOf(bucketName);
    if (bucketIndex !== -1) {
      return parts.slice(bucketIndex + 1).join('/');
    }
    return url;
  }
}

module.exports = new AffiliateService();
