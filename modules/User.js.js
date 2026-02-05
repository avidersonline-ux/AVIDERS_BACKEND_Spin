const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  fcm_tokens: { type: [String], default: [] },
  
  // Wallet
  walletCoins: { type: Number, default: 100 },
  lockedCoins: { type: Number, default: 0 }, // For pending transactions
  
  // Spins
  freeSpins: { type: Number, default: 1 },
  bonusSpins: { type: Number, default: 0 },
  lastSpin: { type: Date, default: null },
  
  // Stats
  totalSpinsCount: { type: Number, default: 0 },
  dailyFreeSpinsCount: { type: Number, default: 0 },
  adBonusSpinsCount: { type: Number, default: 0 },
  wonBonusSpinsCount: { type: Number, default: 0 },
  
  // Referral
  referralCode: { type: String, unique: true },
  referredBy: { type: String, default: null },
  referralCount: { type: Number, default: 0 },
  referralEarnings: { type: Number, default: 0 },
  
  // Subscriptions
  activeSubscriptions: [{
    planId: String,
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ['active', 'expired', 'cancelled'] }
  }],
  
  // Profile
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  avatar: { type: String, default: '' },
  
  // Settings
  notificationsEnabled: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);