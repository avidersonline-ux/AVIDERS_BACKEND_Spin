const Claim = require("../../models/Claim");
const { uploadToR2 } = require("../../services/r2.service");
const walletService = require("../wallet/wallet.service");
const { SOURCES } = require("../wallet/transaction.types");
const { sendSuccess } = require("../../utils/responseHandler");
const { AppError } = require("../../utils/errorHandler");

class ClaimsController {
  async submitClaim(req, res, next) {
    const { userId, orderId, productName, orderAmount, purchaseSource } = req.body;
    const file = req.file;

    // 1. Validation
    if (!userId || !orderId || !productName || !orderAmount || !purchaseSource) {
      return next(new AppError("All fields are required", 400));
    }

    if (parseFloat(orderAmount) <= 0) {
      return next(new AppError("Order amount must be greater than 0", 400));
    }

    if (!file) {
      return next(new AppError("Screenshot is required", 400));
    }

    // 2. Prepare R2 file path
    const timestamp = Date.now();
    const extension = file.originalname.split(".").pop();
    const fileName = `claims/${userId}/${timestamp}.${extension}`;

    // 3. Upload to R2
    const screenshotUrl = await uploadToR2(file.buffer, fileName, file.mimetype);

    // 4. Calculate Reward (1:1 for now)
    const rewardCoins = Math.floor(parseFloat(orderAmount));

    // 5. Save to MongoDB
    const claim = new Claim({
      userId,
      orderId,
      productName,
      orderAmount: parseFloat(orderAmount),
      purchaseSource,
      screenshotUrl,
      rewardCoins,
    });

    try {
      await claim.save();

      sendSuccess(res, {
        message: "Claim submitted successfully",
        screenshotUrl,
        rewardCoins,
        claimId: claim._id
      }, "Claim submitted successfully", 201);
    } catch (error) {
      if (error.code === 11000) {
        return next(new AppError("Order ID already exists", 400));
      }
      next(error);
    }
  }

  async getUserClaims(req, res, next) {
    const { userId } = req.params;
    const claims = await Claim.find({ userId }).sort({ createdAt: -1 });
    sendSuccess(res, claims);
  }

  async getPendingClaims(req, res, next) {
    const claims = await Claim.find({ status: "PENDING" }).sort({ createdAt: 1 });
    sendSuccess(res, claims);
  }

  /**
   * Admin: Approve a claim and credit wallet
   */
  async approveClaim(req, res, next) {
    const { claimId } = req.body;
    if (!claimId) return next(new AppError("Claim ID is required", 400));

    const claim = await Claim.findById(claimId);
    if (!claim) return next(new AppError("Claim not found", 404));
    if (claim.status !== "PENDING") return next(new AppError("Claim already processed", 400));

    // 1. Update status
    claim.status = "APPROVED";
    await claim.save();

    // 2. Credit wallet
    await walletService.credit(
      claim.userId,
      claim.rewardCoins,
      SOURCES.CASHBACK,
      `claim_appr_${claim._id}`,
      { claimId: claim._id, orderId: claim.orderId }
    );

    sendSuccess(res, claim, "Claim approved and coins credited");
  }

  /**
   * Admin: Reject a claim
   */
  async rejectClaim(req, res, next) {
    const { claimId, reason } = req.body;
    if (!claimId) return next(new AppError("Claim ID is required", 400));

    const claim = await Claim.findById(claimId);
    if (!claim) return next(new AppError("Claim not found", 404));
    if (claim.status !== "PENDING") return next(new AppError("Claim already processed", 400));

    claim.status = "REJECTED";
    // Optional: store rejection reason if model supports it
    await claim.save();

    sendSuccess(res, claim, "Claim rejected");
  }
}

module.exports = new ClaimsController();
