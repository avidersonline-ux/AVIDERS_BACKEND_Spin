// modules/spinwheel-service/models/Spin.js

const mongoose = require("mongoose");

const SpinSchema = new mongoose.Schema({
  uid: { type: String, required: true },      // Firebase UID
  email: { type: String },                    // optional

  reward: {
    type: {
      type: String,         // "coins", "coupon", "none"
      required: true,
    },
    value: Number,
    code: String,
  },

  source: {
    type: String,
    enum: ["daily", "bonus", "affiliate"],
    default: "daily",
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Spin", SpinSchema);
