// modules/spinwheel-service/models/SpinHistory.js
const mongoose = require("mongoose");

const spinHistorySchema = new mongoose.Schema({
  uid: { type: String, required: true },
  reward_type: { type: String, required: true },
  reward_value: { type: Number, default: 0 },
  reward_code: { type: String, default: null },
  reward_label: { type: String, required: true },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.SpinHistory || mongoose.model("SpinHistory", spinHistorySchema);
