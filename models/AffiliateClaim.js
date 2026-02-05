const mongoose = require('mongoose');

const affiliateClaimSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  orderId: { type: String, required: true, unique: true, index: true },
  productName: { type: String, required: true },
  orderAmount: { type: Number, required: true },
  rewardCoins: { type: Number, required: true },
  affiliateNetwork: { type: String, required: true },
  screenshotUrl: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'matured'],
    default: 'pending',
    index: true
  },
  maturityDays: { type: Number, default: 30 },
  adminNote: { type: String },
  approvedAt: { type: Date },
  maturedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('AffiliateClaim', affiliateClaimSchema);
