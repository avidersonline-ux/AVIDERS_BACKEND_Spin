const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema({
  userUid: String,
  userEmail: String,
  type: String,
  amount: Number,
  description: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("WalletLedger", WalletSchema);
