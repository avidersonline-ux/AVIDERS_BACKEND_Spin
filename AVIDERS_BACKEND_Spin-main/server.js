const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

const app = express();

// =====================
// MIDDLEWARE
// =====================
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'https://your-flutter-app.com'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`, req.body || '');
  next();
});

// =====================
// REWARDS CONFIGURATION
// =====================
let rewardsConfig = [];
try {
  const configPath = path.join(__dirname, 'modules', 'spinwheel-service', 'config', 'rewards.config.json');
  const configData = fs.readFileSync(configPath, 'utf8');
  rewardsConfig = JSON.parse(configData).rewards;
  
  // Validate probabilities sum to ~1.0
  const totalProb = rewardsConfig.reduce((sum, r) => sum + r.probability, 0);
  if (Math.abs(totalProb - 1.0) > 0.01) {
    console.warn(`⚠️ Reward probabilities sum to ${totalProb}, should be 1.0`);
  }
  
  console.log(`✅ Loaded ${rewardsConfig.length} rewards from config`);
} catch (error) {
  console.error("❌ Failed to load rewards config:", error.message);
  process.exit(1); // Exit if rewards config is missing
}

// =====================
// DATABASE CONNECTION
// =====================
const MONGODB_URI = process.env.MONGO_URI_SPIN || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGO_URI not set");
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
  })
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// =====================
// DATABASE SCHEMAS
// =====================

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true, index: true },
  email: { type: String, default: "" },
  walletCoins: { type: Number, default: 100 },
  freeSpinAvailable: { type: Boolean, default: true },
  lastFreeSpinGiven: { type: Date, default: null },
  lastFreeSpinUsed: { type: Date, default: null },
  bonusSpins: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const spinHistorySchema = new mongoose.Schema({
  uid: { type: String, required: true, index: true },
  email: { type: String, default: "" },
  spinSource: { 
    type: String, 
    enum: ['daily_free', 'ad_rewarded', 'bonus', 'regular'], 
    default: 'daily_free' 
  },
  sector: { type: Number, required: true },
  rewardType: { type: String, required: true },
  rewardValue: { type: Number, default: 0 },
  rewardLabel: { type: String, required: true },
  rewardCode: { type: String, default: null },
  coinsEarned: { type: Number, default: 0 },
  walletAfter: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const SpinHistory = mongoose.model('SpinHistory', spinHistorySchema);

// =====================
// HELPER FUNCTIONS
// =====================

/**
 * Ensure user exists and update free spin availability
 */
async function ensureUser(uid, email = "") {
  let user = await User.findOne({ uid });
  
  if (!user) {
    user = new User({
      uid,
      email,
      walletCoins: 100,
      freeSpinAvailable: true,
      lastFreeSpinGiven: new Date(),
      bonusSpins: 0
    });
    await user.save();
    console.log(`👤 Created user: ${uid}`);
    return user;
  }
  
  // Update email if provided and different
  if (email && email !== user.email) {
    user.email = email;
  }
  
  // Check if 24 hours passed since last free spin given
  const now = new Date();
  if (!user.lastFreeSpinGiven || 
      (now - user.lastFreeSpinGiven) >= 24 * 60 * 60 * 1000) {
    user.freeSpinAvailable = true;
    user.lastFreeSpinGiven = now;
    console.log(`🎁 Free spin renewed for ${uid}`);
  }
  
  user.updatedAt = now;
  await user.save();
  
  return user;
}

/**
 * Select reward based on probability
 */
function selectReward() {
  const random = Math.random();
  let cumulative = 0;
  
  for (let i = 0; i < rewardsConfig.length; i++) {
    cumulative += rewardsConfig[i].probability;
    if (random <= cumulative) {
      return { ...rewardsConfig[i], sector: i };
    }
  }
  
  // Fallback to last reward
  return { ...rewardsConfig[rewardsConfig.length - 1], sector: rewardsConfig.length - 1 };
}

// =====================
// INPUT VALIDATION
// =====================
function validateUID(uid) {
  return uid && typeof uid === 'string' && uid.trim().length > 0;
}

// =====================
// API ENDPOINTS
// =====================

/**
 * Health check
 */
app.get("/health", async (req, res) => {
  const userCount = await User.countDocuments().catch(() => 0);
  const spinCount = await SpinHistory.countDocuments().catch(() => 0);
  
  res.json({ 
    success: true,
    service: "Spin Wheel API",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    stats: {
      total_users: userCount,
      total_spins: spinCount,
      rewards_loaded: rewardsConfig.length
    }
  });
});

/**
 * GET STATUS - Returns user spin status and available rewards
 */
app.post("/api/spin/status", async (req, res) => {
  try {
    const { uid, email } = req.body;
    
    if (!validateUID(uid)) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }
    
    const user = await ensureUser(uid, email);
    
    // Return rewards WITHOUT probability (client doesn't need to know)
    const clientRewards = rewardsConfig.map(reward => ({
      type: reward.type,
      value: reward.value,
      label: reward.label,
      code: reward.code
    }));
    
    res.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        walletCoins: user.walletCoins,
        freeSpinAvailable: user.freeSpinAvailable,
        bonusSpins: user.bonusSpins,
        lastFreeSpinGiven: user.lastFreeSpinGiven,
        createdAt: user.createdAt
      },
      rewards: clientRewards,
      message: "Status retrieved successfully"
    });
    
  } catch (error) {
    console.error('❌ Status error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

/**
 * POST SPIN - Perform the actual spin
 */
app.post("/api/spin/spin", async (req, res) => {
  try {
    const { uid, email } = req.body;
    
    if (!validateUID(uid)) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }
    
    const user = await ensureUser(uid, email);
    
    // Check spin availability
    const hasFreeSpinAvailable = user.freeSpinAvailable;
    const hasBonusSpins = user.bonusSpins > 0;
    
    if (!hasFreeSpinAvailable && !hasBonusSpins) {
      return res.json({ 
        success: false, 
        message: "No spins available",
        user: {
          walletCoins: user.walletCoins,
          freeSpinAvailable: false,
          bonusSpins: user.bonusSpins
        }
      });
    }
    
    // Determine spin source
    let spinSource = 'regular';
    if (hasFreeSpinAvailable) {
      spinSource = 'daily_free';
      user.freeSpinAvailable = false;
      user.lastFreeSpinUsed = new Date();
    } else if (hasBonusSpins) {
      spinSource = 'ad_rewarded';
      user.bonusSpins -= 1;
    }
    
    // SELECT REWARD (server-side only!)
    const reward = selectReward();
    
    // Update wallet if coins reward
    let coinsEarned = 0;
    if (reward.type === 'coins' && reward.value > 0) {
      coinsEarned = reward.value;
      user.walletCoins += coinsEarned;
    }
    
    // Add bonus spins if reward type is 'bonus_spin'
    let bonusSpinsEarned = 0;
    if (reward.type === 'bonus_spin' && reward.value > 0) {
      bonusSpinsEarned = reward.value;
      user.bonusSpins += bonusSpinsEarned;
    }
    
    // Save user
    user.updatedAt = new Date();
    await user.save();
    
    // Save spin history
    const spinHistory = new SpinHistory({
      uid: user.uid,
      email: user.email,
      spinSource,
      sector: reward.sector,
      rewardType: reward.type,
      rewardValue: reward.value || 0,
      rewardLabel: reward.label,
      rewardCode: reward.code || null,
      coinsEarned,
      walletAfter: user.walletCoins,
      timestamp: new Date()
    });
    await spinHistory.save();
    
    console.log(`🎰 Spin completed: ${uid} → Sector ${reward.sector} → ${reward.label} (${spinSource})`);
    if (bonusSpinsEarned > 0) {
      console.log(`🎁 Bonus spins earned: ${bonusSpinsEarned} → New balance: ${user.bonusSpins}`);
    }
    
    // Return complete result to client
    res.json({
      success: true,
      sector: reward.sector,
      reward: {
        type: reward.type,
        value: reward.value || 0,
        label: reward.label,
        code: reward.code || null
      },
      spinSource,
      user: {
        walletCoins: user.walletCoins,
        freeSpinAvailable: user.freeSpinAvailable,
        bonusSpins: user.bonusSpins
      },
      coinsEarned,
      bonusSpinsEarned,
      message: `You won: ${reward.label}`
    });
    
  } catch (error) {
    console.error('❌ Spin error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

/**
 * POST BONUS - Add bonus spin (after watching ad)
 */
app.post("/api/spin/bonus", async (req, res) => {
  try {
    const { uid, email } = req.body;
    
    if (!validateUID(uid)) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }
    
    const user = await ensureUser(uid, email);
    user.bonusSpins += 1;
    user.updatedAt = new Date();
    await user.save();
    
    console.log(`➕ Bonus spin added: ${uid} → Total: ${user.bonusSpins}`);
    
    res.json({
      success: true,
      bonusSpins: user.bonusSpins,
      message: "Bonus spin added successfully"
    });
    
  } catch (error) {
    console.error('❌ Bonus error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

/**
 * POST LEDGER - Get user spin history
 */
app.post("/api/spin/ledger", async (req, res) => {
  try {
    const { uid } = req.body;
    
    if (!validateUID(uid)) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }
    
    const user = await User.findOne({ uid });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    
    const history = await SpinHistory.find({ uid })
      .sort({ timestamp: -1 })
      .limit(100);
    
    res.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        walletCoins: user.walletCoins,
        freeSpinAvailable: user.freeSpinAvailable,
        bonusSpins: user.bonusSpins,
        createdAt: user.createdAt
      },
      history: history,
      totalSpins: history.length,
      message: "Ledger retrieved successfully"
    });
    
  } catch (error) {
    console.error('❌ Ledger error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

/**
 * POST RESET - Reset user data (for testing)
 */
app.post("/api/spin/reset", async (req, res) => {
  try {
    const { uid } = req.body;
    
    if (!validateUID(uid)) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }
    
    await User.deleteOne({ uid });
    await SpinHistory.deleteMany({ uid });
    
    console.log(`🔄 User reset: ${uid}`);
    
    res.json({
      success: true,
      message: "User data reset successfully"
    });
    
  } catch (error) {
    console.error('❌ Reset error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

/**
 * GET ADMIN USERS - Admin endpoint to view all users
 */
app.get("/api/spin/admin/users", async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }
    
    const users = await User.find().sort({ createdAt: -1 });
    const totalSpins = await SpinHistory.countDocuments();
    
    res.json({
      success: true,
      total_users: users.length,
      total_spins: totalSpins,
      users: users
    });
    
  } catch (error) {
    console.error('❌ Admin error:', error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// =====================
// ERROR HANDLERS
// =====================

app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: "Endpoint not found",
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error('🔥 Error:', err);
  res.status(500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message 
  });
});

// =====================
// START SERVER
// =====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 Spin Wheel Server Running`);
  console.log(`${'='.repeat(50)}`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
  console.log(`🎯 Rewards loaded: ${rewardsConfig.length}`);
  console.log(`${'='.repeat(50)}\n`);
});
