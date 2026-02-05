const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: [
      'spin_reward',
      'referral_bonus',
      'cashback',
      'subscription_payment',
      'subscription_reward',
      'scan_pay',
      'transfer_sent',
      'transfer_received',
      'spending'
    ]
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  source: { type: String, default: '' },
  referenceId: { type: String, default: '' }, // For idempotency
  metadata: { type: Object, default: {} },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'reversed'],
    default: 'completed'
  },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
