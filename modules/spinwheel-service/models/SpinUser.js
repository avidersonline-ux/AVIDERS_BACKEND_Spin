// modules/spinwheel-service/models/SpinUser.js
const mongoose = require("mongoose");

const spinUserSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  free_spin_available: { type: Boolean, default: true },
  last_free_spin_given: { type: Date, default: null },   // server-side give timestamp
  free_spin_used_at: { type: Date, default: null },      // when user used free spin
  bonus_spins: { type: Number, default: 0 },
  reward_ads_used_today: { type: Number, default: 0 },
  reward_ads_last_reset: { type: Date, default: null },
  email: { type: String, default: "" },
  fcm_tokens: { type: [String], default: [] },           // store FCM tokens for notifications
  spin_balance: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: true });

// index to efficiently find users needing reset
spinUserSchema.index({ last_free_spin_given: 1 });

module.exports = mongoose.models.SpinUser || mongoose.model("SpinUser", spinUserSchema);
