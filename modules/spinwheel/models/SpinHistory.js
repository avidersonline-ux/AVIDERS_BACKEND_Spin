const mongoose = require("mongoose");

const SpinHistorySchema = new mongoose.Schema({
  uid: { type: String, required: true },
  reward: { type: Number, required: true },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("SpinHistory", SpinHistorySchema);
