const Claim = require("../../models/Claim");
const { uploadToR2 } = require("../../services/r2.service");
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
}

module.exports = new ClaimsController();
