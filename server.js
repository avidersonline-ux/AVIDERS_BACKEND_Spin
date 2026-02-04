/**
 * AVIDERS Spin Wheel Server (Optimized + Safe Wallet Sync)
 * - Referral codes unique (no duplicate crash)
 * - Wallet sync safe: idempotent per transaction referenceId (no balance-diff sync)
 * - Rewards probability validated/normalized
 * - Admin overview optimized (cached + limited)
 * - Reset endpoint secured
 */

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Production security & performance imports
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const Joi = require("joi");

// =====================
// FIREBASE ADMIN SDK
// =====================

let admin;
let firebaseInitialized = false;

try {
  admin = require("firebase-admin");

  if (!admin.apps.length) {
    // Priority 1: Env JSON for Render
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        firebaseInitialized = true;
        console.log("✅ Firebase Admin initialized from GOOGLE_APPLICATION_CREDENTIALS_JSON");
      } catch (parseError) {
        console.error("❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:", parseError.message);
      }
    } else {
      // Priority 2: Local file for development
      const serviceAccountPath = path.join(__dirname, "middleware", "serviceAccount.json");
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        firebaseInitialized = true;
        console.log("✅ Firebase Admin initialized from file");
      } else {
        console.log("⚠️ Firebase Admin: No credentials found (FCM disabled)");
        admin = null;
      }
    }
  } else {
    firebaseInitialized = true;
  }
} catch (error) {
  console.log("⚠️ Firebase Admin SDK not available:", error.message);
  console.log("   FCM notifications will be disabled");
  admin = null;
}

const app = express();
app.set("trust proxy", 1);

// =====================
// SECURITY MIDDLEWARE
// =====================

app.use(helmet());
app.use(compression());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((x) => x.trim())
  : ["http://localhost:3000", "http://localhost:5000"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow mobile/curl

      if (process.env.NODE_ENV === "production" && allowedOrigins.length > 0) {
        if (!allowedOrigins.includes(origin)) {
          console.log(`🚫 CORS blocked: ${origin}`);
          return callback(new Error("CORS: Origin not allowed"), false);
        }
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: false,
  })
);

app.use(express.json({ limit: "10mb" }));

// =====================
// AXIOS CONFIG (timeouts)
// =====================
const http = axios.create({
  timeout: 8000,
});

// =====================
// WALLET SYNC HELPER (SAFE)
// =====================

// Spin server will send only "earn" events to central wallet.
// Deduplication must happen on wallet service using (userId + referenceId) unique logic.

const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || "https://aviders-wallet.onrender.com";

async function syncToWalletEarn({ uid, amount, source, referenceId }) {
  try {
    const response = await http.post(`${WALLET_SERVICE_URL}/api/wallet/earn`, {
      userId: uid,
      amount,
      source,
      referenceId,
    });

    if (response.data?.success === false) {
      console.error(`❌ Wallet earn rejected for ${uid}:`, response.data);
      return { success: false, error: response.data?.message || "Wallet rejected" };
    }

    console.log(`✅ Wallet synced: +${amount} AVD | uid=${uid} | ref=${referenceId}`);
    return { success: true };
  } catch (error) {
    const msg = error.response?.data?.error || error.response?.data?.message || error.message;
    console.error(`❌ Failed wallet sync | uid=${uid} | ref=${referenceId} | error=${msg}`);
    return { success: false, error: msg };
  }
}

async function getCentralWalletBalance(uid) {
  try {
    const response = await http.get(`${WALLET_SERVICE_URL}/api/wallet/balance/${uid}`);
    if (response.data?.success) {
      return {
        success: true,
        balance: response.data.balance,
        totalEarned: response.data.totalEarned || 0,
      };
    }
    return { success: false, balance: 0, error: response.data?.message || "Unknown error" };
  } catch (error) {
    console.error(`❌ Failed to fetch central wallet for ${uid}:`, error.message);
    return { success: false, balance: 0, error: error.message };
  }
}

// =====================
// INPUT VALIDATION
// =====================

const validateReferralRequest = (req, res, next) => {
  const schema = Joi.object({
    uid: Joi.string().min(1).max(100).required(),
    referralCode: Joi.string()
      .pattern(/^AVD[A-Z0-9]{2,20}$/i)
      .required()
      .messages({
        "string.pattern.base": "Referral code must start with AVD and contain alphanumeric characters",
      }),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }
  next();
};

const validateSpinRequest = (req, res, next) => {
  const schema = Joi.object({
    uid: Joi.string().min(1).max(100).required(),
    email: Joi.string().email().optional().allow(""),
    token: Joi.string().optional().allow(""),
  }).unknown(true);

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }
  next();
};

function requireAdminKey(req, res, next) {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ success: false, message: "Admin access denied" });
  }
  next();
}

function requireInternalKey(req, res, next) {
  const internalKey = req.headers["x-internal-key"];
  if (!internalKey || internalKey !== process.env.SPIN_INTERNAL_KEY) {
    return res.status(403).json({ success: false, message: "Internal access denied" });
  }
  next();
}

// =====================
// RATE LIMITING
// =====================

const spinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { success: false, message: "Too many spin attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250,
  message: { success: false, message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/spin/spin", spinLimiter);
app.use("/api/", apiLimiter);

// =====================
// REWARDS CONFIGURATION
// =====================

let rewardsConfig = [];
try {
  const configPath = path.join(__dirname, "modules", "spinwheel-service", "config", "rewards.config.json");
  if (fs.existsSync(configPath)) {
    const configData = fs.readFileSync(configPath, "utf8");
    rewardsConfig = JSON.parse(configData).rewards;
    console.log(`✅ Rewards loaded from config file: ${rewardsConfig.length}`);
  } else {
    throw new Error("Rewards config missing");
  }
} catch (error) {
  console.error("❌ Rewards config load failed, using fallback:", error.message);
  rewardsConfig = [
    { type: "coins", value: 10, probability: 0.3, label: "10 AVD Coins" },
    { type: "coins", value: 20, probability: 0.2, label: "20 AVD Coins" },
    { type: "coins", value: 5, probability: 0.4, label: "5 AVD Coins" },
    { type: "none", value: 0, probability: 0.05, label: "Try Again" },
    { type: "coins", value: 15, probability: 0.03, label: "15 AVD Coins" },
    { type: "bonus_spin", value: 1, probability: 0.01, label: "Extra Spin" },
    { type: "coins", value: 25, probability: 0.01, label: "25 AVD Coins" },
  ];
}

/**
 * Validate & normalize rewards probabilities:
 * - Ensure sum > 0
 * - Normalize to 1
 * - If sum < 1 and you want "none" remainder, you could add it.
 */
function normalizeRewardsProbabilities() {
  const sum = rewardsConfig.reduce((acc, r) => acc + (Number(r.probability) || 0), 0);

  if (!sum || sum <= 0) {
    console.warn("⚠️ Rewards probability sum is 0. Setting equal distribution.");
    const equal = 1 / rewardsConfig.length;
    rewardsConfig = rewardsConfig.map((r) => ({ ...r, probability: equal }));
    return;
  }

  // Normalize if slightly off
  const normalized = rewardsConfig.map((r) => ({
    ...r,
    probability: (Number(r.probability) || 0) / sum,
  }));

  rewardsConfig = normalized;

  const afterSum = rewardsConfig.reduce((acc, r) => acc + r.probability, 0);
  console.log(`✅ Rewards probabilities normalized. Sum=${afterSum.toFixed(6)}`);
}
normalizeRewardsProbabilities();

// =====================
// DATABASE CONNECTION
// =====================

mongoose.set("strictQuery", true);

const MONGODB_URI = process.env.MONGO_URI_SPIN || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGO_URI_SPIN not set. Data will not persist.");
} else {
  console.log("🔗 Connecting MongoDB...");
  mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.error("❌ MongoDB connection failed:", err.message));
}

// =====================
// DATABASE SCHEMAS
// =====================

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true },
    email: { type: String, default: "" },
    fcm_tokens: { type: [String], default: [] },

    freeSpins: { type: Number, default: 1 },
    bonusSpins: { type: Number, default: 0 },

    walletCoins: { type: Number, default: 100 },
    lastSpin: { type: Date, default: null },

    // Stats
    totalSpinsCount: { type: Number, default: 0 },
    dailyFreeSpinsCount: { type: Number, default: 0 },
    adBonusSpinsCount: { type: Number, default: 0 },
    wonBonusSpinsCount: { type: Number, default: 0 },

    // Referral
    referralCode: { type: String, unique: true, index: true },
    referredBy: { type: String, default: null },
    referralRewarded: { type: Boolean, default: false },
    referralCount: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const spinHistorySchema = new mongoose.Schema(
  {
    uid: { type: String, required: true },
    email: { type: String, default: "" },

    spinSource: {
      type: String,
      required: true,
      enum: ["daily_free", "ad_rewarded", "bonus", "regular", "referral"],
    },

    sector: { type: Number, default: -1 },
    rewardType: { type: String, required: true },
    rewardValue: { type: Number, default: 0 },
    rewardLabel: { type: String, required: true },
    rewardCode: { type: String, default: null },

    coinsEarned: { type: Number, default: 0 },
    walletAfter: { type: Number, required: true },

    // ✅ Track wallet sync per transaction (SAFE SYNC)
    walletSynced: { type: Boolean, default: false },
    walletSyncError: { type: String, default: "" },

    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.index({ uid: 1 });
userSchema.index({ referralCode: 1 });
spinHistorySchema.index({ uid: 1, timestamp: -1 });
spinHistorySchema.index({ walletSynced: 1, timestamp: -1 });

const User = mongoose.model("User", userSchema);
const SpinHistory = mongoose.model("SpinHistory", spinHistorySchema);

// =====================
// REQUEST LOGGING
// =====================

app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`, req.body?.uid ? `UID:${req.body.uid}` : "");
  next();
});

// =====================
// REFERRAL CODE GENERATION (SAFE UNIQUE)
// =====================

function randomReferralCode(len = 7) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid confusing chars
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `AVD${out}`;
}

async function generateUniqueReferralCode() {
  // try up to 10 times
  for (let i = 0; i < 10; i++) {
    const code = randomReferralCode(7);
    const exists = await User.findOne({ referralCode: code }).select("_id").lean();
    if (!exists) return code;
  }
  // fallback hard unique
  return `AVD${Date.now().toString(36).toUpperCase()}`;
}

// =====================
// HELPER: ENSURE USER
// =====================

const ensureUser = async (uid) => {
  let user = await User.findOne({ uid });

  if (!user) {
    const referralCode = await generateUniqueReferralCode();

    user = new User({
      uid,
      freeSpins: 1,
      bonusSpins: 0,
      walletCoins: 100,
      referralCode,
    });

    try {
      await user.save();
      console.log(`👤 New user created: ${uid} | ReferralCode=${user.referralCode}`);
    } catch (err) {
      // Rare race condition duplicate referralCode → retry once
      if (String(err.message || "").includes("E11000")) {
        user.referralCode = await generateUniqueReferralCode();
        await user.save();
        console.log(`👤 New user created with retry: ${uid} | ReferralCode=${user.referralCode}`);
      } else {
        throw err;
      }
    }
  }

  return user;
};

// =====================
// API ENDPOINTS
// =====================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🎰 AVIDERS Spin Wheel API Server",
    version: "3.0.0",
    features: ["safe_wallet_sync", "fcm_notifications", "referral_system", "probability_normalized"],
    endpoints: {
      health: "/health",
      spin_status: "/api/spin/status",
      spin: "/api/spin/spin",
      bonus: "/api/spin/bonus",
      ledger: "/api/spin/ledger",
      referral_apply: "/api/referral/apply",
      register_token: "/api/spin/register-token",
      reset_admin_only: "/api/spin/admin/reset-user",
      sync_pending_wallet: "/api/spin/admin/sync-pending-wallet",
      admin_users: "/api/spin/admin/users",
      admin_referral_stats: "/api/spin/admin/referral-stats",
    },
  });
});

// Health check
app.get("/health", async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
  try {
    const userCount = await User.countDocuments().catch(() => 0);
    const spinCount = await SpinHistory.countDocuments().catch(() => 0);

    res.json({
      success: true,
      message: "Server is running",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      database: dbStatus,
      stats: {
        total_users: userCount,
        total_spins: spinCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Health check failed", error: error.message });
  }
});

// =====================
// SPIN API ENDPOINTS
// =====================

// Status
app.post("/api/spin/status", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    const user = await ensureUser(uid);

    if (req.body?.email) {
      if (!user.email || user.email !== req.body.email) {
        user.email = req.body.email;
        await user.save();
      }
    }

    const frontendRewards = rewardsConfig.map((reward) => ({
      type: reward.type,
      value: reward.value,
      label: reward.label,
      code: reward.code,
    }));

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
        referralCount: user.referralCount || 0,
      },
      central_wallet: {
        available: centralWallet.success,
        balance: centralWallet.balance,
        total_earned: centralWallet.totalEarned || 0,
        last_updated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Status error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// Bonus spin
app.post("/api/spin/bonus", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    const user = await ensureUser(uid);
    user.bonusSpins += 1;
    await user.save();

    res.json({ success: true, bonus_spins: user.bonusSpins, message: "Bonus spin added" });
  } catch (error) {
    console.error("❌ Bonus spin error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// Register token
app.post("/api/spin/register-token", validateSpinRequest, async (req, res) => {
  try {
    const { uid, token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "Token is required" });

    await ensureUser(uid);
    await User.updateOne({ uid }, { $addToSet: { fcm_tokens: token } });

    res.json({ success: true, message: "Token registered successfully" });
  } catch (error) {
    console.error("❌ Register token error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Perform spin
app.post("/api/spin/spin", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    const user = await ensureUser(uid);

    if (user.freeSpins <= 0 && user.bonusSpins <= 0) {
      return res.json({
        success: false,
        message: "No spins available. Watch an ad or wait for tomorrow.",
      });
    }

    // Determine spin source
    let spinSource = "regular";
    if (user.freeSpins > 0) {
      user.freeSpins -= 1;
      spinSource = "daily_free";
      user.dailyFreeSpinsCount += 1;
    } else {
      user.bonusSpins -= 1;
      spinSource = "ad_rewarded";
      user.adBonusSpinsCount += 1;
    }

    user.totalSpinsCount += 1;
    user.lastSpin = new Date();

    // Reward selection
    const randomValue = Math.random();
    let cumulative = 0;
    let selectedReward = rewardsConfig[rewardsConfig.length - 1];

    for (const reward of rewardsConfig) {
      cumulative += reward.probability;
      if (randomValue <= cumulative) {
        selectedReward = reward;
        break;
      }
    }

    const rewardIndex = rewardsConfig.indexOf(selectedReward);

    // Apply reward
    if (selectedReward.type === "coins") {
      user.walletCoins += selectedReward.value;
    } else if (selectedReward.type === "bonus_spin") {
      user.bonusSpins += selectedReward.value;
      user.wonBonusSpinsCount += selectedReward.value;
    }

    await user.save();

    // Create spin history row with walletSynced=false (default)
    const spinHistory = await SpinHistory.create({
      uid,
      email: user.email || "",
      spinSource,
      sector: rewardIndex,
      rewardType: selectedReward.type,
      rewardValue: selectedReward.value || 0,
      rewardLabel: selectedReward.label,
      rewardCode: selectedReward.code || null,
      coinsEarned: selectedReward.type === "coins" ? selectedReward.value : 0,
      walletAfter: user.walletCoins,
    });

    // ✅ SAFE WALLET SYNC (idempotent referenceId = spinHistory._id)
    if (selectedReward.type === "coins" && selectedReward.value > 0) {
      const refId = spinHistory._id.toString();
      const result = await syncToWalletEarn({
        uid,
        amount: selectedReward.value,
        source: "spinwheel",
        referenceId: refId,
      });

      if (result.success) {
        await SpinHistory.updateOne(
          { _id: spinHistory._id },
          { $set: { walletSynced: true, walletSyncError: "" } }
        );
      } else {
        await SpinHistory.updateOne(
          { _id: spinHistory._id },
          { $set: { walletSynced: false, walletSyncError: result.error || "sync_failed" } }
        );
      }
    }

    res.json({
      success: true,
      sector: rewardIndex,
      reward: selectedReward,
      free_spin_available: user.freeSpins > 0,
      bonus_spins: user.bonusSpins,
      wallet_coins: user.walletCoins,
      message: `You won: ${selectedReward.label}`,
    });
  } catch (error) {
    console.error("❌ Spin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ledger
app.post("/api/spin/ledger", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    const user = await ensureUser(uid);

    const history = await SpinHistory.find({ uid }).sort({ timestamp: -1 }).limit(50).lean();

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
        referralCount: user.referralCount,
        referralEarnings: user.referralEarnings,
        createdAt: user.createdAt,
      },
      history,
      totalHistory: history.length,
    });
  } catch (error) {
    console.error("❌ Ledger error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Referral apply
app.post("/api/referral/apply", validateReferralRequest, async (req, res) => {
  try {
    const { uid, referralCode } = req.body;
    const code = referralCode.trim().toUpperCase();

    const newUser = await ensureUser(uid);

    if (newUser.referredBy) {
      return res.json({ success: false, message: "You already used a referral code" });
    }

    if ((newUser.referralCode || "").toUpperCase() === code) {
      return res.json({ success: false, message: "You cannot use your own referral code" });
    }

    const referrer = await User.findOne({ referralCode: code });
    if (!referrer) {
      return res.json({ success: false, message: "Invalid referral code" });
    }

    // Apply rewards
    referrer.walletCoins += 100;
    referrer.referralEarnings += 100;
    referrer.referralCount += 1;
    await referrer.save();

    newUser.referredBy = referrer.uid;
    newUser.walletCoins += 50;
    newUser.referralRewarded = true;
    await newUser.save();

    // History entries
    const refTx = await SpinHistory.create({
      uid: referrer.uid,
      email: referrer.email || "",
      spinSource: "referral",
      sector: -1,
      rewardType: "coins",
      rewardValue: 100,
      rewardLabel: "Referral Bonus",
      coinsEarned: 100,
      walletAfter: referrer.walletCoins,
    });

    const newTx = await SpinHistory.create({
      uid: newUser.uid,
      email: newUser.email || "",
      spinSource: "referral",
      sector: -1,
      rewardType: "coins",
      rewardValue: 50,
      rewardLabel: "Welcome Bonus",
      coinsEarned: 50,
      walletAfter: newUser.walletCoins,
    });

    // ✅ Safe sync (idempotent) referenceId = history _id
    const refSync = await syncToWalletEarn({
      uid: referrer.uid,
      amount: 100,
      source: "referral",
      referenceId: refTx._id.toString(),
    });

    await SpinHistory.updateOne(
      { _id: refTx._id },
      { $set: { walletSynced: refSync.success, walletSyncError: refSync.success ? "" : refSync.error } }
    );

    const newSync = await syncToWalletEarn({
      uid: newUser.uid,
      amount: 50,
      source: "referral",
      referenceId: newTx._id.toString(),
    });

    await SpinHistory.updateOne(
      { _id: newTx._id },
      { $set: { walletSynced: newSync.success, walletSyncError: newSync.success ? "" : newSync.error } }
    );

    res.json({
      success: true,
      message: "Referral applied: referrer +100, you +50",
      rewards: {
        referrer: {
          coins: 100,
          total: referrer.walletCoins,
          referralCount: referrer.referralCount,
          totalReferralEarnings: referrer.referralEarnings,
        },
        newUser: { coins: 50, total: newUser.walletCoins },
      },
    });
  } catch (error) {
    console.error("❌ Referral error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =====================
// ADMIN ENDPOINTS
// =====================

// Admin users list
app.get("/api/spin/admin/users", requireAdminKey, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(300).lean();
    const totalSpins = await SpinHistory.countDocuments();

    res.json({
      success: true,
      total_users: users.length,
      total_spins: totalSpins,
      users,
    });
  } catch (error) {
    console.error("❌ Admin users error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// Admin referral stats
app.get("/api/spin/admin/referral-stats", requireAdminKey, async (req, res) => {
  try {
    const topReferrers = await User.find({ referralCount: { $gt: 0 } })
      .sort({ referralCount: -1 })
      .limit(20)
      .select("uid email referralCode referralCount referralEarnings walletCoins createdAt")
      .lean();

    const referralStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalReferrals: { $sum: "$referralCount" },
          totalReferralEarnings: { $sum: "$referralEarnings" },
          usersWithReferrals: {
            $sum: { $cond: [{ $gt: ["$referralCount", 0] }, 1, 0] },
          },
          avgReferralsPerUser: { $avg: "$referralCount" },
        },
      },
    ]);

    res.json({
      success: true,
      overall_stats: referralStats[0] || {},
      top_referrers: topReferrers,
    });
  } catch (error) {
    console.error("❌ Admin referral stats error:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// ✅ Admin: reset a user (secure replacement for public /reset)
app.post("/api/spin/admin/reset-user", requireAdminKey, validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    await User.deleteOne({ uid });
    await SpinHistory.deleteMany({ uid });

    res.json({ success: true, message: `User ${uid} reset successfully` });
  } catch (error) {
    console.error("❌ Admin reset error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Admin: Sync pending wallet transactions (SAFE FIX)
app.post("/api/spin/admin/sync-pending-wallet", requireAdminKey, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);

    const pending = await SpinHistory.find({
      walletSynced: false,
      rewardType: "coins",
      coinsEarned: { $gt: 0 },
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    let synced = 0;
    let failed = 0;

    for (const tx of pending) {
      const result = await syncToWalletEarn({
        uid: tx.uid,
        amount: tx.coinsEarned,
        source: tx.spinSource || "spinwheel",
        referenceId: tx._id.toString(),
      });

      if (result.success) {
        synced++;
        await SpinHistory.updateOne(
          { _id: tx._id },
          { $set: { walletSynced: true, walletSyncError: "" } }
        );
      } else {
        failed++;
        await SpinHistory.updateOne(
          { _id: tx._id },
          { $set: { walletSynced: false, walletSyncError: result.error || "sync_failed" } }
        );
      }
    }

    res.json({
      success: true,
      checked: pending.length,
      synced,
      failed,
      message: "Pending wallet sync completed",
    });
  } catch (error) {
    console.error("❌ Pending wallet sync error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Internal: Reset daily free spins
app.post("/api/spin/admin/reset-daily", requireInternalKey, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await User.updateMany(
      { $or: [{ lastSpin: null }, { lastSpin: { $lt: cutoff } }] },
      { $set: { freeSpins: 1 } }
    );

    res.json({
      success: true,
      message: "Daily free spins reset completed",
      updated_count: result.modifiedCount,
    });
  } catch (error) {
    console.error("❌ Reset daily error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Internal: FCM notify
app.post("/api/spin/admin/run-notify", requireInternalKey, async (req, res) => {
  try {
    if (!admin || !firebaseInitialized) {
      return res.status(503).json({
        success: false,
        message: "FCM not configured",
      });
    }

    const users = await User.find({
      freeSpins: { $gt: 0 },
      fcm_tokens: { $exists: true, $not: { $size: 0 } },
    });

    let notifiedCount = 0;

    for (const user of users) {
      try {
        const message = {
          notification: {
            title: "🎰 Your Free Spin is Ready!",
            body: "Spin the wheel now to win rewards!",
          },
          tokens: user.fcm_tokens,
          data: {
            type: "daily_spin_reminder",
            screen: "spin_wheel",
            uid: user.uid,
          },
        };

        await admin.messaging().sendEachForMulticast(message);
        notifiedCount++;
      } catch (error) {
        console.error(`❌ Failed notify ${user.uid}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: "FCM notifications processed",
      users_notified: notifiedCount,
      total_eligible: users.length,
    });
  } catch (error) {
    console.error("❌ Run notify error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =====================
// 404 + ERROR HANDLING
// =====================

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl,
  });
});

app.use((err, req, res, next) => {
  console.error("🔥 Global Error Handler:", err);

  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: "Too many requests, please try again later",
    });
  }

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

// =====================
// PROCESS HANDLERS
// =====================

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Promise Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  if (process.env.NODE_ENV === "production") process.exit(1);
});

// =====================
// SERVER STARTUP
// =====================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Spin Wheel Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🎯 Rewards loaded: ${rewardsConfig.length}`);
  console.log(`🛡️ Helmet + RateLimit + Compression enabled`);
  console.log(`📱 Firebase Admin: ${firebaseInitialized ? "✅ Initialized" : "❌ Disabled"}`);

  const dbStatus = mongoose.connection.readyState === 1 ? "✅ Connected" : "❌ Disconnected";
  console.log(`💾 MongoDB: ${dbStatus}`);
});

const gracefulShutdown = () => {
  console.log("🔄 Shutdown signal received, closing gracefully...");
  server.close(() => {
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
