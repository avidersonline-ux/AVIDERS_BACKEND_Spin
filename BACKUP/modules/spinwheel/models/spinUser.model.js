const mongoose = require("mongoose");

const SpinUserSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String },

  // Free spin: only once per day
  last_spin_date: { type: String, default: null },
  free_spin_used_today: { type: Boolean, default: false },

  // Bonus spins earned from watching ads
  spin_balance: { type: Number, default: 0 },

  // Wallet coins
  coins: { type: Number, default: 0 },

  rewards: [
    {
      type: { type: String },
      value: Number,
      code: String,
      claimed: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model("SpinUser", SpinUserSchema);
