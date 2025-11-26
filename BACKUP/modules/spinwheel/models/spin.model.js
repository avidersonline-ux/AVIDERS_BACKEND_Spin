const mongoose = require("mongoose");

const SpinSchema = new mongoose.Schema({
  userUid: { type: String, required: true },       // Firebase UID
  userEmail: { type: String, required: true },     // For admin visibility

  reward: {
    type: {
      type: String,     // "coins", "coupon", "none"
      required: true
    },
    value: Number,
    code: String
  },

  source: {
    type: String,
    enum: ["daily", "bonus", "affiliate"],
    default: "daily"
  },

  affiliateOrderId: String,

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Spin", SpinSchema);
