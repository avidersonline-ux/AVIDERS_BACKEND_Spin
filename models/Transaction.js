const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: ['CREDIT', 'DEBIT']
  },
  source: {
    type: String,
    required: true,
    // ✅ Added AFFILIATE and AFFILIATE_MATURED to support shopping rewards
    enum: [
      'SPIN',
      'REFERRAL',
      'CASHBACK',
      'SUBSCRIPTION',
      'MANUAL',
      'SPEND',
      'AFFILIATE',
      'AFFILIATE_MATURED'
    ]
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  referenceId: { type: String, required: true, unique: true },
  metadata: { type: Object, default: {} },
  description: { type: String },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  }
}, { timestamps: true });

transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
