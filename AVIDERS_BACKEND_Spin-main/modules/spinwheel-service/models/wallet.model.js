const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true
  },
  coins: {
    type: Number,
    default: 0
  },
  last_updated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);
