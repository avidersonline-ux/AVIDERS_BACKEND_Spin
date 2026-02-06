const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  uid: { type: String, required: true, index: true },
  orderId: { type: String, required: true, unique: true },
  orderAmount: { type: Number, required: true },
  screenshotUrl: { type: String, required: true },
  rewardCoins: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  maturityDays: { type: Number, default: 60 },
  maturityDate: { type: Date },
  reviewedBy: { type: String },
  adminNote: { type: String },
  matured: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Claim', claimSchema);
