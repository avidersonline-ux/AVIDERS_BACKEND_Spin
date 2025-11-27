// modules/spinwheel-service/models/SpinUser.js

const mongoose = require("mongoose");

const SpinUserSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true },
    email: { type: String },

    last_spin_date: { type: String, default: null },
    free_spin_used_today: { type: Boolean, default: false },

    spin_balance: { type: Number, default: 0 },

    coins: { type: Number, default: 0 },

    rewards: [
      {
        type: { type: String },
        value: Number,
        code: String,
        claimed: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// 👇 Correct model name
module.exports = mongoose.model("SpinUser", SpinUserSchema);
