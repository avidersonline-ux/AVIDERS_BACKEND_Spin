const mongoose = require("mongoose");

const SpinUser = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },

    lastSpinDate: Date,
    bonusSpins: { type: Number, default: 0 },
    walletCoins: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SpinUser", SpinUser);
