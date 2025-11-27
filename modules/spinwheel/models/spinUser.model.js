const mongoose = require("mongoose");

const SpinUserSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true },
    email: { type: String },

    // Free spin: only once per day
    last_spin_date: { type: String, default: null },
    free_spin_used_today: { type: Boolean, default: false },

    // Bonus spins earned from watching reward ads
    spin_balance: { type: Number, default: 0 },

    // Wallet coins
    coins: { type: Number, default: 0 },

    // Rewards history
    rewards: [
      {
        type: { type: String },
        value: Number,
        code: String,
        claimed: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
      }
    ],

    // ★ NEW: Daily Reward Ads Limit System
    reward_ads_used_today: { type: Number, default: 0 },
    reward_ads_last_reset: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SpinUser", SpinUserSchema);
