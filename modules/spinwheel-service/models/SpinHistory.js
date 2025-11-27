// modules/spinwheel-service/models/SpinHistory.js

const mongoose = require("mongoose");

const SpinHistorySchema = new mongoose.Schema({
  uid: { type: String, required: true },
  date: { type: Date, default: Date.now },
  reward: Object,
  amount: Number,
});

module.exports = mongoose.model("SpinHistory", SpinHistorySchema);
