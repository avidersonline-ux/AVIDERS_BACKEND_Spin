const { PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, bucketName } = require('../../config/r2');
const Claim = require('../../models/Claim');
const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');
const mongoose = require('mongoose');
const { AppError } = require('../../utils/errorHandler');

class ClaimsService {
  /**
   * Upload screenshot to R2 and create pending claim
   */
  async createClaim(uid, orderId, orderAmount, file) {
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

    const screenshotUrl = `https://pub-your-r2-worker-url.r2.dev/${fileName}`; // Replace with actual public URL or keep as key

    // 3. Calculate Reward (Example: 10 AVD per 100 INR)
    const rewardCoins = Math.floor(orderAmount * 0.10);

    // 4. Create Claim Record
    return await Claim.create({
      uid,
      orderId,
      orderAmount,
      screenshotUrl: fileName, // Store the key/path
      rewardCoins,
      status: 'pending'
    });
  }

  /**
   * Approve claim and lock coins for maturity
   */
  async approveClaim(claimId, adminId, adminNote) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const claim = await Claim.findById(claimId).session(session);
      if (!claim || claim.status !== 'pending') {
        throw new AppError('Claim not found or already processed', 404);
      }

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
      claim.maturityDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
      claim.screenshotUrl = newKey;
      await claim.save({ session });

      // 3. Credit to Wallet (Locked)
      await Wallet.findOneAndUpdate(
        { userId: claim.uid },
        { $inc: { lockedBalance: claim.rewardCoins } },
        { upsert: true, session }
      );

      // 4. Record Transaction
      await Transaction.create([{
        userId: claim.uid,
        type: 'CREDIT',
        source: 'CASHBACK',
        amount: claim.rewardCoins,
        balanceAfter: 0, // Placeholder for locked
        referenceId: `claim_appr_${claim._id}`,
        metadata: { claimId: claim._id, orderId: claim.orderId },
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
}

module.exports = new ClaimsService();
