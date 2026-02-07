const { PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, bucketName } = require('../../config/r2');
const Claim = require('../../models/Claim');
const walletService = require('../wallet/wallet.service');
const { SOURCES } = require('../wallet/transaction.types');
const mongoose = require('mongoose');
const { AppError } = require('../../utils/errorHandler');

class ClaimsService {
  /**
   * Upload screenshot to R2 and create pending claim
   */
  async createClaim(claimData, file) {
    const { uid, orderId, orderAmount, productName, source, expectedReward } = claimData;

    // 1. Idempotency Check
    const existing = await Claim.findOne({ orderId });
    if (existing) throw new AppError('This order ID has already been submitted', 400);

    // 2. Upload to R2 (pending folder)
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `claims/pending/${uid}_${orderId}_${Date.now()}.${fileExtension}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    // 3. Calculate Reward (Example: 10 AVD per 100 INR if not provided)
    const rewardCoins = expectedReward || Math.floor(orderAmount * 0.10);

    // 4. Create Claim Record
    return await Claim.create({
      uid,
      orderId,
      orderAmount,
      productName,
      source,
      screenshotUrl: fileName,
      rewardCoins,
      status: 'pending'
    });
  }

  /**
   * Approve claim and credit coins
   */
  async approveClaim(claimId, adminId, adminNote) {
    const claim = await Claim.findById(claimId);
    if (!claim || claim.status !== 'pending') {
      throw new AppError('Claim not found or already processed', 404);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Move file to approved folder in R2
      const newKey = claim.screenshotUrl.replace('pending', 'approved');
      await s3Client.send(new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${claim.screenshotUrl}`,
        Key: newKey,
      }));
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: claim.screenshotUrl,
      }));

      // 2. Update Claim
      claim.status = 'approved';
      claim.reviewedBy = adminId;
      claim.adminNote = adminNote;
      claim.screenshotUrl = newKey;
      await claim.save({ session });

      // 3. Credit to Wallet using WalletService
      await walletService.credit(
        claim.uid,
        claim.rewardCoins,
        SOURCES.CASHBACK,
        `claim_appr_${claim._id}`,
        { claimId: claim._id, orderId: claim.orderId },
        false // sync to user.walletCoins
      );

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
   * Reject claim
   */
  async rejectClaim(claimId, adminId, adminNote) {
    const claim = await Claim.findById(claimId);
    if (!claim || claim.status !== 'pending') {
      throw new AppError('Claim not found or already processed', 404);
    }

    // Move file to rejected folder
    const newKey = claim.screenshotUrl.replace('pending', 'rejected');
    await s3Client.send(new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: `${bucketName}/${claim.screenshotUrl}`,
      Key: newKey,
    }));
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: claim.screenshotUrl,
    }));

    claim.status = 'rejected';
    claim.reviewedBy = adminId;
    claim.adminNote = adminNote;
    claim.screenshotUrl = newKey;
    return await claim.save();
  }

  async getUserClaims(uid) {
    return await Claim.find({ uid }).sort({ createdAt: -1 });
  }

  async getPendingClaims() {
    return await Claim.find({ status: 'pending' }).sort({ createdAt: 1 });
  }
}

module.exports = new ClaimsService();
