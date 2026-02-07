const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, unique: true },
    productName: { type: String, required: true },
    orderAmount: { type: Number, required: true },
    purchaseSource: { type: String, required: true }, // e.g., Amazon, Flipkart
    screenshotUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    rewardCoins: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Claim", claimSchema);
