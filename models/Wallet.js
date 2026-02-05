const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  unlockedBalance: { type: Number, default: 0 },
  lockedBalance: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },

  // Breakdown for aggregation and insights
  breakdown: {
    spin: { type: Number, default: 0 },
    referral: { type: Number, default: 0 },
    cashback: { type: Number, default: 0 },
    subscription: { type: Number, default: 0 },
    manual: { type: Number, default: 0 }
  },

  lastTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  status: { type: String, enum: ['active', 'frozen'], default: 'active' }
}, { timestamps: true });

// Ensure balance doesn't go negative
walletSchema.pre('save', function(next) {
  if (this.unlockedBalance < 0) {
    return next(new Error('Insufficient wallet balance'));
  }
  next();
});

module.exports = mongoose.model('Wallet', walletSchema);
