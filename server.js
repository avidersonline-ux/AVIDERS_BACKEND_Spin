const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios"); // Added for central wallet sync

// Production security & performance imports
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const Joi = require('joi');

// =====================
// FIREBASE ADMIN SDK
// =====================

let admin;
let firebaseInitialized = false;

try {
  admin = require('firebase-admin');

  // Try to initialize Firebase Admin if not already initialized
  if (!admin.apps.length) {
    // Priority 1: Use environment variable (Render deployment)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        firebaseInitialized = true;
        console.log("✅ Firebase Admin SDK initialized from environment variable");
      } catch (parseError) {
        console.error("❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:", parseError.message);
      }
    }
    // Priority 2: Fall back to file (local development)
    else {
      const serviceAccountPath = path.join(__dirname, 'middleware', 'serviceAccount.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        firebaseInitialized = true;
        console.log("✅ Firebase Admin SDK initialized from file");
      } else {
        console.log("⚠️  Firebase Admin: No credentials found");
        console.log("   Set GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable");
        console.log("   or add middleware/serviceAccount.json file");
        admin = null;
      }
    }
  } else {
    firebaseInitialized = true;
  }
} catch (error) {
  console.log("⚠️  Firebase Admin SDK not available:", error.message);
  console.log("   FCM notifications will be disabled");
  admin = null;
}

const app = express();

// Trust proxy for Render/Railway/Heroku
app.set('trust proxy', 1);

// =====================
// SECURITY MIDDLEWARE
// =====================

// 1. Helmet - Security headers
app.use(helmet());

// 2. Compression - Gzip compression
app.use(compression());

// 3. CORS - Configure allowed origins
// Hybrid approach: Allow specific origins + mobile app compatibility
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow all origins during development, restrict in production
    if (process.env.NODE_ENV === 'production' && allowedOrigins.length > 0) {
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        console.log(`🚫 CORS blocked: ${origin}`);
        return callback(new Error(msg), false);
      }
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: false
}));

app.use(express.json({ limit: '10mb' }));

// =====================
// WALLET SYNC HELPER
// =====================
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || "https://aviders-wallet.onrender.com";

async function syncToWallet(uid, amount, source, referenceId) {
  try {
    const response = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/earn`, {
      userId: uid,
      amount: amount,
      source: source,
      referenceId: referenceId
    });
    console.log(`✅ Synced ${amount} AVD to central wallet for ${uid}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to sync to wallet for ${uid}: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// =====================
// WALLET BALANCE CHECK FUNCTION - ADDED THIS
// =====================

async function getCentralWalletBalance(uid) {
  try {
    const response = await axios.get(`${WALLET_SERVICE_URL}/api/wallet/balance/${uid}`);
    if (response.data.success) {
      return {
        success: true,
        balance: response.data.balance,
        totalEarned: response.data.totalEarned || 0
      };
    }
    return { success: false, balance: 0, error: response.data.message };
  } catch (error) {
    console.error(`❌ Failed to fetch central wallet for ${uid}:`, error.message);
    return { success: false, balance: 0, error: error.message };
  }
}

// =====================
// INPUT VALIDATION SCHEMAS
// =====================

// Referral validation schema
const validateReferralRequest = (req, res, next) => {
  const schema = Joi.object({
    uid: Joi.string().min(1).max(100).required(),
    referralCode: Joi.string().pattern(/^AVD[A-Z0-9]{1,20}$/i).required().messages({
      'string.pattern.base': 'Referral code must start with AVD followed by alphanumeric characters'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }
  next();
};

// Spin request validation
const validateSpinRequest = (req, res, next) => {
  const schema = Joi.object({
    uid: Joi.string().min(1).max(100).required(),
    email: Joi.string().email().optional().allow(''),
    token: Joi.string().optional().allow('')
  }).unknown(true);

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }
  next();
};

// =====================
// RATE LIMITING
// =====================

const spinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 spin requests per windowMs
  message: {
    success: false,
    message: "Too many spin attempts, please try again later"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased limit for general API
  message: {
    success: false,
    message: "Too many requests, please try again later"
  }
});

// Apply rate limiting
app.use("/api/spin/spin", spinLimiter);
app.use("/api/", apiLimiter);

// =====================
// REWARDS CONFIGURATION
// =====================

let rewardsConfig = [];
try {
  const configPath = path.join(__dirname, 'modules', 'spinwheel-service', 'config', 'rewards.config.json');
  if (fs.existsSync(configPath)) {
    const configData = fs.readFileSync(configPath, 'utf8');
    rewardsConfig = JSON.parse(configData).rewards;
    console.log(`✅ Rewards configuration loaded: ${rewardsConfig.length} rewards`);
  } else {
    throw new Error("Rewards config file missing");
  }
} catch (error) {
  console.error("❌ Failed to load rewards config, using fallback rewards:", error.message);
  // Fallback rewards
  rewardsConfig = [
    { type: "coins", value: 10, probability: 0.3, label: "10 AVD Coins" },
    { type: "coins", value: 20, probability: 0.2, label: "20 AVD Coins" },
    { type: "coins", value: 5, probability: 0.4, label: "5 AVD Coins" },
    { type: "none", value: 0, probability: 0.05, label: "Try Again" },
    { type: "coins", value: 15, probability: 0.25, label: "15 AVD Coins" },
    { type: "bonus_spin", value: 1, probability: 0.1, label: "Extra Spin" },
    { type: "coins", value: 25, probability: 0.15, label: "25 AVD Coins" },
    { type: "none", value: 0, probability: 0.05, label: "Better Luck" }
  ];
}

// =====================
// DATABASE CONNECTION
// =====================

const MONGODB_URI = process.env.MONGO_URI_SPIN || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGO_URI_SPIN environment variable is not set");
  console.log("🔄 Using in-memory storage only - data will not persist");
} else {
  console.log("🔗 Attempting MongoDB connection...");
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✅ MongoDB Connected - Data will be saved permanently");
  })
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err.message);
  });
}

// =====================
// DATABASE SCHEMAS
// =====================

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, default: "" },
  fcm_tokens: { type: [String], default: [] },
  freeSpins: { type: Number, default: 1 },
  bonusSpins: { type: Number, default: 0 },
  walletCoins: { type: Number, default: 100 },
  lastSpin: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  // Lifetime spin statistics
  totalSpinsCount: { type: Number, default: 0 },
  dailyFreeSpinsCount: { type: Number, default: 0 },
  adBonusSpinsCount: { type: Number, default: 0 },
  wonBonusSpinsCount: { type: Number, default: 0 },
  // REFERRAL FIELDS - UPDATED WITH REFERRAL COUNT
  referralCode: { type: String, unique: true },
  referredBy: { type: String, default: null },
  referralRewarded: { type: Boolean, default: false },
  referralCount: { type: Number, default: 0 },      // NEW: Count of successful referrals
  referralEarnings: { type: Number, default: 0 }    // Existing: Total coins earned from referrals
}, {
  timestamps: true
});

const spinHistorySchema = new mongoose.Schema({
  uid: { type: String, required: true },
  email: { type: String, default: "" },
  spinSource: {
    type: String,
    required: true,
    enum: ['daily_free', 'ad_rewarded', 'bonus', 'regular', 'referral']
  },
  sector: { type: Number, default: -1 },
  rewardType: { type: String, required: true },
  rewardValue: { type: Number, default: 0 },
  rewardLabel: { type: String, required: true },
  rewardCode: { type: String, default: null },
  coinsEarned: { type: Number, default: 0 },
  walletAfter: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Create indexes for better performance
userSchema.index({ uid: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ referralCount: -1 }); // For finding top referrers
spinHistorySchema.index({ uid: 1, timestamp: -1 });

// MongoDB Models
const User = mongoose.model('User', userSchema);
const SpinHistory = mongoose.model('SpinHistory', spinHistorySchema);

// =====================
// REQUEST LOGGING
// =====================

app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`, req.body?.uid ? `UID: ${req.body.uid}` : '');
  next();
});

// =====================
// API ENDPOINTS
// =====================

// Root endpoint - UPDATED VERSION AND ENDPOINTS
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🎰 AVIDERS Spin Wheel API Server",
    version: "2.7.0", // UPDATED VERSION
    features: ["wallet_sync", "fcm_notifications", "referral_system"],
    endpoints: {
      health: "/health",
      spin_status: "/api/spin/status",
      spin: "/api/spin/spin",
      bonus: "/api/spin/bonus",
      ledger: "/api/spin/ledger",
      referral_apply: "/api/referral/apply",
      register_token: "/api/spin/register-token",
      reset: "/api/spin/reset",
      sync_wallet: "/api/spin/sync-wallet", // NEW ENDPOINT
      admin_reset: "/api/spin/admin/reset-daily",
      admin_notify: "/api/spin/admin/run-notify",
      admin_users: "/api/spin/admin/users",
      admin_referral_stats: "/api/spin/admin/referral-stats",
      admin_wallet_sync_overview: "/api/spin/admin/wallet-sync-overview" // NEW ENDPOINT
    }
  });
});

// Health check endpoint
app.get("/health", async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";

  try {
    const userCount = await User.countDocuments().catch(() => 0);
    const spinCount = await SpinHistory.countDocuments().catch(() => 0);

    // Get referral stats
    const referralStats = await User.aggregate([
      { $group: {
          _id: null,
          totalReferrals: { $sum: "$referralCount" },
          totalReferralEarnings: { $sum: "$referralEarnings" },
          usersWithReferrals: { $sum: { $cond: [{ $gt: ["$referralCount", 0] }, 1, 0] } }
        }
      }
    ]).catch(() => [{ totalReferrals: 0, totalReferralEarnings: 0, usersWithReferrals: 0 }]);

    res.json({
      success: true,
      message: "Server is running",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: dbStatus,
      stats: {
        total_users: userCount,
        total_spins: spinCount,
        total_referrals: referralStats[0]?.totalReferrals || 0,
        total_referral_earnings: referralStats[0]?.totalReferralEarnings || 0,
        users_with_referrals: referralStats[0]?.usersWithReferrals || 0
      },
      rewards_config: {
        loaded: rewardsConfig.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Health check failed",
      error: error.message
    });
  }
});

// =====================
// HELPER FUNCTIONS
// =====================

// Ensure user exists in MongoDB
const ensureUser = async (uid) => {
  try {
    let user = await User.findOne({ uid });

    if (!user) {
      // Generate alphanumeric referral code
      const cleanUid = uid.toString().replaceAll('-', '').toUpperCase();
      const suffix = cleanUid.length > 6 ? cleanUid.slice(-6) : cleanUid;
      const genCode = `AVD${suffix}`;

      user = new User({
        uid,
        freeSpins: 1,
        bonusSpins: 0,
        walletCoins: 100,
        referralCode: genCode
      });
      await user.save();
      console.log(`👤 New user created: ${uid} | Referral Code: ${user.referralCode}`);
    }

    return user;
  } catch (error) {
    console.error("❌ Error ensuring user:", error);
    throw error;
  }
};

// =====================
// SPIN API ENDPOINTS
// =====================

// Get user status and available spins - UPDATED WITH WALLET SYNC INFO
app.post("/api/spin/status", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    const user = await ensureUser(uid);

    // Update email if provided
    if (req.body?.email) {
      if (!user.email || user.email !== req.body.email) {
        user.email = req.body.email;
        await user.save();
      }
    }

    // Prepare rewards for frontend (without probability)
    const frontendRewards = rewardsConfig.map(reward => ({
      type: reward.type,
      value: reward.value,
      label: reward.label,
      code: reward.code
    }));

    // Get central wallet balance - NEW
    const centralWallet = await getCentralWalletBalance(uid);

    res.json({
      success: true,
      free_spin_available: user.freeSpins > 0,
      bonus_spins: user.bonusSpins,
      wallet_coins: user.walletCoins,
      referral_code: user.referralCode,
      referred_by: user.referredBy || null,
      rewards: frontendRewards,
      statistics: {
        totalSpins: user.totalSpinsCount || 0,
        dailyFreeSpins: user.dailyFreeSpinsCount || 0,
        adBonusSpins: user.adBonusSpinsCount || 0,
        wonBonusSpins: user.wonBonusSpinsCount || 0,
        referralEarnings: user.referralEarnings || 0,
        referralCount: user.referralCount || 0
      },
      // NEW: Central wallet information
      central_wallet: {
        available: centralWallet.success,
        balance: centralWallet.balance,
        total_earned: centralWallet.totalEarned || 0,
        last_updated: new Date().toISOString()
      },
      // NEW: Sync status indicator
      sync_status: {
        local_balance: user.walletCoins,
        sync_required: centralWallet.success ? user.walletCoins > centralWallet.balance : false,
        message: centralWallet.success ? 
          "Wallet sync active" : 
          "Central wallet temporarily unavailable"
      }
    });
  } catch (error) {
    console.error('❌ Status error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// Add bonus spin
app.post("/api/spin/bonus", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    const user = await ensureUser(uid);
    user.bonusSpins += 1;
    await user.save();

    res.json({
      success: true,
      bonus_spins: user.bonusSpins,
      message: "Bonus spin added successfully!"
    });
  } catch (error) {
    console.error('❌ Bonus spin error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// Register FCM token
app.post("/api/spin/register-token", validateSpinRequest, async (req, res) => {
  try {
    const { uid, token } = req.body;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required"
      });
    }

    await ensureUser(uid);
    await User.updateOne(
      { uid },
      { $addToSet: { fcm_tokens: token } }
    );

    res.json({
      success: true,
      message: "Token registered successfully"
    });
  } catch (error) {
    console.error('❌ Register token error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Perform a spin
app.post("/api/spin/spin", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    const user = await ensureUser(uid);

    // Check if user has spins available
    if (user.freeSpins <= 0 && user.bonusSpins <= 0) {
      return res.json({
        success: false,
        message: "No spins available. Watch an ad or wait for tomorrow's free spin."
      });
    }

    // Determine spin source and deduct
    let spinSource = 'regular';
    if (user.freeSpins > 0) {
      user.freeSpins -= 1;
      spinSource = 'daily_free';
      user.dailyFreeSpinsCount += 1;
    } else if (user.bonusSpins > 0) {
      user.bonusSpins -= 1;
      spinSource = 'ad_rewarded';
      user.adBonusSpinsCount += 1;
    }

    user.totalSpinsCount += 1;
    user.lastSpin = new Date();

    // Probability-based reward selection
    const randomValue = Math.random();
    let cumulativeProbability = 0;
    let selectedReward = rewardsConfig[0];

    for (const reward of rewardsConfig) {
      cumulativeProbability += reward.probability;
      if (randomValue <= cumulativeProbability) {
        selectedReward = reward;
        break;
      }
    }

    const rewardIndex = rewardsConfig.findIndex(r => r === selectedReward);

    // Apply reward
    if (selectedReward.type === "coins") {
      user.walletCoins += selectedReward.value;
    } else if (selectedReward.type === "bonus_spin") {
      user.bonusSpins += selectedReward.value;
      user.wonBonusSpinsCount += selectedReward.value;
    }

    await user.save();

    // Save spin history
    const spinHistory = new SpinHistory({
      uid: uid,
      email: user.email || '',
      spinSource: spinSource,
      sector: rewardIndex,
      rewardType: selectedReward.type,
      rewardValue: selectedReward.value || 0,
      rewardLabel: selectedReward.label,
      rewardCode: selectedReward.code || null,
      coinsEarned: selectedReward.type === 'coins' ? selectedReward.value : 0,
      walletAfter: user.walletCoins
    });
    await spinHistory.save();

    // SYNC TO CENTRAL WALLET
    if (selectedReward.type === "coins") {
       await syncToWallet(uid, selectedReward.value, "spinwheel", spinHistory._id.toString());
    }

    console.log(`🎰 Spin completed for ${uid}: ${selectedReward.label}`);

    res.json({
      success: true,
      sector: rewardIndex,
      reward: selectedReward,
      free_spin_available: user.freeSpins > 0,
      bonus_spins: user.bonusSpins,
      wallet_coins: user.walletCoins,
      message: `Congratulations! You won: ${selectedReward.label}`
    });
  } catch (error) {
    console.error('❌ Spin error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get user ledger/history
app.post("/api/spin/ledger", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    const user = await ensureUser(uid);
    const history = await SpinHistory.find({ uid })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        freeSpins: user.freeSpins,
        bonusSpins: user.bonusSpins,
        walletCoins: user.walletCoins,
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        referralCount: user.referralCount,  // NEW: Include referral count in ledger
        referralEarnings: user.referralEarnings,
        createdAt: user.createdAt
      },
      history: history,
      totalHistory: history.length
    });
  } catch (error) {
    console.error('❌ Ledger error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Apply referral code - UPDATED WITH REFERRAL COUNT TRACKING
app.post("/api/referral/apply", validateReferralRequest, async (req, res) => {
  try {
    const { uid, referralCode } = req.body;
    const code = referralCode.trim().toUpperCase();
    const newUser = await ensureUser(uid);

    // Validation checks
    if (newUser.referredBy) {
      return res.json({
        success: false,
        message: "You have already used a referral code"
      });
    }

    if (newUser.referralCode === code) {
      return res.json({
        success: false,
        message: "You cannot use your own referral code"
      });
    }

    const referrer = await User.findOne({ referralCode: code });
    if (!referrer) {
      return res.json({
        success: false,
        message: "Invalid referral code"
      });
    }

    // Apply referral rewards - UPDATED TO INCREMENT REFERRAL COUNT
    referrer.walletCoins += 100;
    referrer.referralEarnings += 100;
    referrer.referralCount += 1;  // NEW: Increment referral count
    await referrer.save();

    newUser.referredBy = referrer.uid;
    newUser.walletCoins += 50; // Welcome bonus for new user
    newUser.referralRewarded = true;
    await newUser.save();

    // Create history entries
    await SpinHistory.create({
      uid: referrer.uid,
      email: referrer.email || '',
      spinSource: "referral",
      rewardType: "coins",
      rewardValue: 100,
      rewardLabel: "Referral Bonus",
      walletAfter: referrer.walletCoins
    });

    await SpinHistory.create({
      uid: newUser.uid,
      email: newUser.email || '',
      spinSource: "referral",
      rewardType: "coins",
      rewardValue: 50,
      rewardLabel: "Welcome Bonus",
      walletAfter: newUser.walletCoins
    });

    // SYNC TO CENTRAL WALLET
    await syncToWallet(referrer.uid, 100, "referral", `REF_BY_${uid}_${Date.now()}`);
    await syncToWallet(uid, 50, "referral", `WELCOME_${uid}`);

    console.log(`🤝 Referral applied: ${uid} referred by ${referrer.uid}`);
    console.log(`   📊 ${referrer.uid} now has ${referrer.referralCount} referrals`);

    res.json({
      success: true,
      message: "Referral applied successfully! Referrer received 100 coins, you received 50 coins.",
      rewards: {
        referrer: {
          coins: 100,
          total: referrer.walletCoins,
          referralCount: referrer.referralCount,  // NEW: Include referral count in response
          totalReferralEarnings: referrer.referralEarnings
        },
        newUser: { coins: 50, total: newUser.walletCoins }
      }
    });
  } catch (error) {
    console.error('❌ Referral error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Reset user data (for testing)
app.post("/api/spin/reset", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    await User.deleteOne({ uid });
    await SpinHistory.deleteMany({ uid });
    res.json({
      success: true,
      message: "User data reset successfully"
    });
  } catch (error) {
    console.error('❌ Reset error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =====================
// MANUAL WALLET SYNC ENDPOINT - NEW ENDPOINT ADDED
// =====================

app.post("/api/spin/sync-wallet", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    const user = await ensureUser(uid);
    
    // Get current central wallet balance
    const centralWallet = await getCentralWalletBalance(uid);
    
    // Calculate unsynced amount
    const unsyncedAmount = user.walletCoins - (centralWallet.success ? centralWallet.balance : 0);
    
    if (unsyncedAmount <= 0) {
      return res.json({
        success: true,
        message: "Wallet is already in sync",
        sync_required: false,
        local_balance: user.walletCoins,
        central_balance: centralWallet.balance || 0
      });
    }
    
    // Sync the unsynced amount
    const syncSuccess = await syncToWallet(
      uid,
      unsyncedAmount,
      "manual_sync",
      `MANUAL_SYNC_${Date.now()}`
    );
    
    if (syncSuccess) {
      // Get updated central wallet balance
      const updatedCentralWallet = await getCentralWalletBalance(uid);
      
      res.json({
        success: true,
        message: `Successfully synced ${unsyncedAmount} coins to central wallet`,
        details: {
          local_balance_before: user.walletCoins,
          synced_amount: unsyncedAmount,
          central_balance_after: updatedCentralWallet.balance || 0
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to sync to central wallet",
        sync_required: true,
        unsynced_amount: unsyncedAmount
      });
    }
    
  } catch (error) {
    console.error('❌ Manual wallet sync error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =====================
// ADMIN ENDPOINTS
// =====================

// Admin: Get all users (requires admin key)
app.get("/api/spin/admin/users", async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        message: "Admin access denied"
      });
    }

    const users = await User.find().sort({ createdAt: -1 }).lean();
    const totalSpins = await SpinHistory.countDocuments();

    res.json({
      success: true,
      total_users: users.length,
      total_spins: totalSpins,
      users: users
    });
  } catch (error) {
    console.error('❌ Admin users error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// NEW: Admin endpoint for referral statistics
app.get("/api/spin/admin/referral-stats", async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        message: "Admin access denied"
      });
    }

    // Get top referrers
    const topReferrers = await User.find({ referralCount: { $gt: 0 } })
      .sort({ referralCount: -1 })
      .limit(20)
      .select('uid email referralCode referralCount referralEarnings walletCoins createdAt')
      .lean();

    // Get overall referral statistics
    const referralStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalReferrals: { $sum: "$referralCount" },
          totalReferralEarnings: { $sum: "$referralEarnings" },
          usersWithReferrals: { $sum: { $cond: [{ $gt: ["$referralCount", 0] }, 1, 0] } },
          avgReferralsPerUser: { $avg: "$referralCount" }
        }
      }
    ]);

    // Get referral distribution
    const referralDistribution = await User.aggregate([
      {
        $match: { referralCount: { $gt: 0 } }
      },
      {
        $bucket: {
          groupBy: "$referralCount",
          boundaries: [1, 2, 3, 5, 10, 20, 50, 100],
          default: "100+",
          output: {
            count: { $sum: 1 },
            totalEarnings: { $sum: "$referralEarnings" }
          }
        }
      }
    ]);

    res.json({
      success: true,
      overall_stats: referralStats[0] || {},
      top_referrers: topReferrers,
      referral_distribution: referralDistribution,
      summary: {
        total_referrals_made: referralStats[0]?.totalReferrals || 0,
        total_coins_earned_from_referrals: referralStats[0]?.totalReferralEarnings || 0,
        percentage_users_with_referrals: referralStats[0] ?
          (referralStats[0].usersWithReferrals / referralStats[0].totalUsers * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('❌ Admin referral stats error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// =====================
// ADMIN: WALLET SYNC OVERVIEW - NEW ENDPOINT ADDED
// =====================

app.get("/api/spin/admin/wallet-sync-overview", async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        message: "Admin access denied"
      });
    }

    // Get all users with wallet balance
    const users = await User.find({ walletCoins: { $gt: 0 } })
      .select('uid walletCoins email referralCode createdAt')
      .limit(100); // Limit to first 100 for performance

    let totalLocalBalance = 0;
    let usersWithUnsynced = 0;
    const syncStatus = [];

    // Check sync status for each user
    for (const user of users) {
      const centralWallet = await getCentralWalletBalance(user.uid);
      const unsyncedAmount = user.walletCoins - (centralWallet.success ? centralWallet.balance : 0);
      
      totalLocalBalance += user.walletCoins;
      
      if (unsyncedAmount > 0) {
        usersWithUnsynced++;
      }
      
      syncStatus.push({
        uid: user.uid,
        local_balance: user.walletCoins,
        central_balance: centralWallet.balance || 0,
        unsynced_amount: unsyncedAmount,
        sync_required: unsyncedAmount > 0,
        last_check: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      overview: {
        total_users_checked: users.length,
        total_local_balance: totalLocalBalance,
        users_requiring_sync: usersWithUnsynced,
        sync_coverage: ((users.length - usersWithUnsynced) / users.length * 100).toFixed(2) + '%'
      },
      sync_status: syncStatus
    });
    
  } catch (error) {
    console.error('❌ Wallet sync overview error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// Admin: Reset daily free spins
app.post("/api/spin/admin/reset-daily", async (req, res) => {
  try {
    const internalKey = req.headers['x-internal-key'];
    if (!internalKey || internalKey !== process.env.SPIN_INTERNAL_KEY) {
      return res.status(403).json({
        success: false,
        message: "Internal access denied"
      });
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await User.updateMany(
      {
        $or: [
          { lastSpin: null },
          { lastSpin: { $lt: cutoff } }
        ]
      },
      {
        $set: { freeSpins: 1 }
      }
    );

    console.log(`🔄 Daily reset: ${result.modifiedCount} users updated`);

    res.json({
      success: true,
      message: "Daily free spins reset completed",
      updated_count: result.modifiedCount
    });
  } catch (error) {
    console.error('❌ Reset daily error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// Admin: Send FCM notifications
app.post("/api/spin/admin/run-notify", async (req, res) => {
  try {
    const internalKey = req.headers['x-internal-key'];
    if (!internalKey || internalKey !== process.env.SPIN_INTERNAL_KEY) {
      return res.status(403).json({
        success: false,
        message: "Internal access denied"
      });
    }

    if (!admin || !firebaseInitialized) {
      return res.status(503).json({
        success: false,
        message: "FCM not configured - Firebase Admin SDK not initialized"
      });
    }

    const users = await User.find({
      freeSpins: { $gt: 0 },
      fcm_tokens: { $exists: true, $not: { $size: 0 } }
    });

    console.log(`📱 Found ${users.length} users eligible for FCM notifications`);

    let notifiedCount = 0;
    for (const user of users) {
      if (user.fcm_tokens && user.fcm_tokens.length > 0) {
        try {
          // Send notification using Firebase Admin
          const message = {
            notification: {
              title: "🎰 Your Free Spin is Ready!",
              body: "Spin the wheel now to win amazing rewards!",
            },
            tokens: user.fcm_tokens,
            data: {
              type: "daily_spin_reminder",
              screen: "spin_wheel",
              uid: user.uid
            }
          };

          await admin.messaging().sendEachForMulticast(message);
          notifiedCount++;
        } catch (error) {
          console.error(`❌ Failed to notify user ${user.uid}:`, error.message);
        }
      }
    }

    res.json({
      success: true,
      message: "FCM notifications processed",
      users_notified: notifiedCount,
      total_eligible: users.length
    });
  } catch (error) {
    console.error('❌ Run notify error:', error);
    res.status(500).json({
      success: false,
      message: "Server error: " + error.message
    });
  }
});

// =====================
// ERROR HANDLING
// =====================

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Global Error Handler:', err);

  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: "Too many requests, please try again later"
    });
  }

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message
  });
});

// =====================
// PROCESS HANDLERS
// =====================

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  // Don't exit in production, just log
  if (process.env.NODE_ENV === 'production') {
    // Optionally send to error tracking service
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Graceful shutdown in production
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// =====================
// SERVER STARTUP
// =====================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Premium Spin Wheel Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎯 Rewards configuration: ${rewardsConfig.length} rewards loaded`);
  console.log(`🛡️ Security: Helmet, Rate Limiting, Compression enabled`);
  console.log(`📱 Firebase Admin: ${firebaseInitialized ? '✅ Initialized' : '❌ Disabled'}`);

  const dbStatus = mongoose.connection.readyState === 1 ? "✅ Connected" : "❌ Disconnected";
  console.log(`💾 MongoDB: ${dbStatus}`);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('🔄 Received shutdown signal, closing server gracefully...');
  server.close(() => {
    console.log('🔒 HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('🔒 MongoDB connection closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// =====================
// MIGRATION SCRIPT (One-time use)
// =====================
// Uncomment and run once to migrate existing data
/*
const migrateReferralCounts = async () => {
  try {
    console.log('🔄 Starting referral count migration...');
    const users = await User.find({ referralEarnings: { $gt: 0 } });

    let migrated = 0;
    for (const user of users) {
      // Calculate referral count from earnings (100 coins per referral)
      const calculatedCount = Math.floor(user.referralEarnings / 100);
      if (user.referralCount !== calculatedCount) {
        user.referralCount = calculatedCount;
        await user.save();
        migrated++;
        console.log(`   Migrated ${user.uid}: ${calculatedCount} referrals`);
      }
    }

    console.log(`✅ Migration completed: ${migrated} users updated`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
};

// Uncomment to run migration on startup
// migrateReferralCounts();
*/
