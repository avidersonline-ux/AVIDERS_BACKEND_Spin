// modules/spinwheel-service/models/Wallet.js

const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  email: { type: String },

  amount: { type: Number, default: 0 },
  type: { type: String }, // "credit", "debit"
  description: String,

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Wallet", WalletSchema);
