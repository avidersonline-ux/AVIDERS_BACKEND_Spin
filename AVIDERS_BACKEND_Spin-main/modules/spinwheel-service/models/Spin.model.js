const mongoose = require("mongoose");

const SpinSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  email: { type: String },

  reward: {
    type: {
      type: String,
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

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Spin", SpinSchema);
