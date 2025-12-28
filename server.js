const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

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

// FIX FOR RENDER PROXY - Add this line
app.set('trust proxy', 1);

// =====================
// SECURITY MIDDLEWARE
// =====================

// 1. Helmet - Security headers
app.use(helmet());

// 2. Compression - Gzip compression
app.use(compression());

// 3. CORS - Configure allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5000']; // Add your production domains

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      console.log(`🚫 CORS blocked: ${origin}`);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST'],
  credentials: false
}));

app.use(express.json());

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
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { 
    success: false, 
    message: "Too many requests, please try again later" 
  }
});

// Apply rate limiting
app.use("/api/spin/spin", spinLimiter);
app.use("/api/", apiLimiter);

// =====================
// INPUT VALIDATION
// =====================

const validateSpinRequest = (req, res, next) => {
  const schema = Joi.object({
    uid: Joi.string().min(5).max(100).required(),
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
// REWARDS CONFIGURATION
// =====================

let rewardsConfig = [];
try {
  const configPath = path.join(__dirname, 'modules', 'spinwheel-service', 'config', 'rewards.config.json');
  const configData = fs.readFileSync(configPath, 'utf8');
  rewardsConfig = JSON.parse(configData).rewards;
  console.log("✅ Rewards configuration loaded successfully");
  console.log(`📊 Loaded ${rewardsConfig.length} rewards from config`);
} catch (error) {
  console.error("❌ Failed to load rewards config, using fallback rewards:", error.message);
  // Fallback rewards
  rewardsConfig = [
    { type: "coins", value: 10, probability: 0.3, label: "10 AVD Coins" },
    { type: "coins", value: 20, probability: 0.2, label: "20 AVD Coins" },
    { type: "coins", value: 5, probability: 0.4, label: "5 AVD Coins" },
    { type: "none", value: 0, probability: 0.05, label: "Try Again" },
    { type: "coins", value: 15, probability: 0.25, label: "15 AVD Coins" },
    { type: "coupon", code: "SPIN10", probability: 0.1, label: "Discount Coupon" },
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
  console.log("🔗 Attempting MongoDB connection with MONGO_URI_SPIN...");
  mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected - Data will be saved permanently");
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    console.log(`🏷️ Cluster: AVIDERS-SPIN-WIN`);
  })
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err.message);
    console.log("🔄 Using in-memory storage as fallback");
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
  wonBonusSpinsCount: { type: Number, default: 0 }
});

const spinHistorySchema = new mongoose.Schema({
  uid: { type: String, required: true },
  email: { type: String, default: "" },
  spinSource: { type: String, required: true, enum: ['daily_free', 'ad_rewarded', 'bonus', 'regular'] },
  sector: { type: Number, required: true },
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

// MongoDB Models
const User = mongoose.model('User', userSchema);
const SpinHistory = mongoose.model('SpinHistory', spinHistorySchema);

// =====================
// REQUEST LOGGING
// =====================

app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`, req.body || '');
  next();
});

// =====================
// API ENDPOINTS
// =====================

// ADDED: Root route for friendly message
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🎰 AVIDERS Spin Wheel API Server",
    version: "2.0.0",
    endpoints: {
      health: "/health",
      spin_status: "/api/spin/status",
      spin: "/api/spin/spin",
      admin_reset: "/api/spin/admin/reset-daily",
      admin_notify: "/api/spin/admin/run-notify",
      admin_users: "/api/spin/admin/users"
    },
    documentation: "All API endpoints require POST with JSON body except /health and /"
  });
});

// Health check with DB status
app.get("/health", async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
  
  // Get some stats
  const userCount = await User.countDocuments().catch(() => 0);
  const spinCount = await SpinHistory.countDocuments().catch(() => 0);
  
  res.json({ 
    success: true, 
    message: "Server is running", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    stats: {
      total_users: userCount,
      total_spins: spinCount
    },
    rewards_config: {
      loaded: rewardsConfig.length,
      rewards: rewardsConfig.map(r => ({ type: r.type, label: r.label }))
    },
    security: {
      cors_enabled: true,
      rate_limiting: true,
      compression: true
    }
  });
});

// Ensure user exists in MongoDB
const ensureUser = async (uid) => {
  try {
    let user = await User.findOne({ uid });
    
    if (!user) {
      user = new User({
        uid,
        freeSpins: 1,
        bonusSpins: 0,
        walletCoins: 100
      });
      await user.save();
      console.log(`👤 New user CREATED in MongoDB: ${uid}`);
    }
    
    return user;
  } catch (error) {
    console.error("❌ Error ensuring user:", error);
    throw error;
  }
};

// SPIN API ENDPOINTS
app.post("/api/spin/status", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    console.log(`🔎 STATUS requested for UID: ${uid}`);
    
    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    const user = await ensureUser(uid);
    
    // Persist email if client sent it
    if (req.body?.email) {
      if (!user.email || user.email !== req.body.email) {
        user.email = req.body.email;
        await user.save();
      }
    }
    
    // Use rewards from config (remove probability field for frontend)
    const frontendRewards = rewardsConfig.map(reward => ({
      type: reward.type,
      value: reward.value,
      label: reward.label,
      code: reward.code
    }));
    
    res.json({
      success: true,
      free_spin_available: user.freeSpins > 0,
      bonus_spins: user.bonusSpins,
      wallet_coins: user.walletCoins,
      rewards: frontendRewards,
      statistics: {
        totalSpins: user.totalSpinsCount || 0,
        dailyFreeSpins: user.dailyFreeSpinsCount || 0,
        adBonusSpins: user.adBonusSpinsCount || 0,
        wonBonusSpins: user.wonBonusSpinsCount || 0
      }
    });
  } catch (error) {
    console.error('❌ Status error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

app.post("/api/spin/bonus", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    console.log(`➕ BONUS requested for UID: ${uid}`);
    
    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    const user = await ensureUser(uid);
    user.bonusSpins += 1;
    await user.save();

    console.log(`✅ Bonus spin ADDED to MongoDB for ${uid}. Total: ${user.bonusSpins}`);
    
    res.json({
      success: true,
      bonus_spins: user.bonusSpins,
      message: "Bonus spin added successfully!"
    });
  } catch (error) {
    console.error('❌ Bonus spin error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

app.post("/api/spin/register-token", validateSpinRequest, async (req, res) => {
  try {
    const { uid, token } = req.body;
    console.log(`📱 FCM TOKEN registration for UID: ${uid}`);
    
    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }
    
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    // Ensure user exists
    await ensureUser(uid);
    
    // Save token using $addToSet to avoid duplicates
    await User.updateOne(
      { uid },
      { $addToSet: { fcm_tokens: token } }
    );

    console.log(`✅ FCM token registered for ${uid}`);
    
    res.json({
      success: true,
      message: "Token registered"
    });
  } catch (error) {
    console.error('❌ Register token error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

app.post("/api/spin/spin", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    console.log(`🎰 SPIN requested for UID: ${uid}`);
    
    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    const user = await ensureUser(uid);
    
    // Persist email if client sent it
    if (req.body?.email) {
      if (!user.email || user.email !== req.body.email) {
        user.email = req.body.email;
        await user.save();
      }
    }
    
    // Check if user has spins
    if (user.freeSpins <= 0 && user.bonusSpins <= 0) {
      return res.json({ success: false, message: "No spins available" });
    }

    // Determine spin source and deduct
    let spinSource = 'regular';
    
    if (user.freeSpins > 0) {
      user.freeSpins -= 1;
      spinSource = 'daily_free';
      user.dailyFreeSpinsCount += 1;  // ✅ Increment daily free counter
    } else if (user.bonusSpins > 0) {
      user.bonusSpins -= 1;
      spinSource = 'ad_rewarded';
      user.adBonusSpinsCount += 1;  // ✅ Increment ad bonus counter
    }

    user.totalSpinsCount += 1;  // ✅ Increment total spin counter
    user.lastSpin = new Date();

    // ✅ USE REWARDS FROM CONFIG FILE with probability-based selection
    const randomValue = Math.random();
    let cumulativeProbability = 0;
    let selectedReward = rewardsConfig[0]; // fallback
    
    for (const reward of rewardsConfig) {
      cumulativeProbability += reward.probability;
      if (randomValue <= cumulativeProbability) {
        selectedReward = reward;
        break;
      }
    }

    // Add sector index for frontend
    const rewardIndex = rewardsConfig.findIndex(r => r === selectedReward);
    const reward = {
      ...selectedReward,
      sector: rewardIndex
    };
    
    // Update wallet if coins reward
    if (reward.type === "coins") {
      user.walletCoins += reward.value;
    }
    
    // Update bonus spins if bonus_spin reward
    if (reward.type === "bonus_spin") {
      user.bonusSpins += reward.value;
      user.wonBonusSpinsCount += reward.value;  // ✅ Increment won spins counter
    }

    // ✅ SAVE USER DATA TO MONGODB
    await user.save();

    // ✅ SAVE SPIN HISTORY TO MONGODB with spinSource
    const coinsEarned = reward.type === 'coins' ? reward.value : 0;
    
    const spinHistory = new SpinHistory({
      uid: uid,
      email: user.email || '',
      spinSource: spinSource,
      sector: reward.sector,
      rewardType: reward.type,
      rewardValue: reward.value || 0,
      rewardLabel: reward.label,
      rewardCode: reward.code || null,
      coinsEarned: coinsEarned,
      walletAfter: user.walletCoins
    });
    await spinHistory.save();

    console.log(`✅ Spin COMPLETED and SAVED to MongoDB for ${uid}. Reward: ${reward.label}, AVD Coins: ${user.walletCoins}`);
    
    res.json({
      success: true,
      sector: reward.sector,
      reward: reward,
      free_spin_available: user.freeSpins > 0,
      bonus_spins: user.bonusSpins,
      wallet_coins: user.walletCoins,
      message: `You won: ${reward.label}`
    });
  } catch (error) {
    console.error('❌ Spin error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// LEDGER endpoint - Get user history from MongoDB
app.post("/api/spin/ledger", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    
    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    const user = await User.findOne({ uid });
    const spinHistoryDocs = await SpinHistory.find({ uid }).sort({ timestamp: -1 }).limit(50);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // Format history with correct field names for Flutter
    const formattedHistory = spinHistoryDocs.map(doc => ({
      _id: doc._id.toString(),
      uid: doc.uid,
      email: doc.email,
      spinSource: doc.spinSource,
      sector: doc.sector,
      rewardType: doc.rewardType,
      rewardValue: doc.rewardValue,
      rewardLabel: doc.rewardLabel,
      rewardCode: doc.rewardCode,
      coinsEarned: doc.coinsEarned,
      walletAfter: doc.walletAfter,
      timestamp: doc.timestamp
    }));

    console.log(`📖 Ledger retrieved for ${uid}: ${formattedHistory.length} history entries`);

    res.json({
      success: true,
      user: {
        uid: user.uid,
        freeSpins: user.freeSpins,
        bonusSpins: user.bonusSpins,
        walletCoins: user.walletCoins,
        createdAt: user.createdAt
      },
      history: formattedHistory,
      totalSpins: formattedHistory.length
    });
  } catch (error) {
    console.error('❌ Ledger error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// RESET endpoint - Delete user data from MongoDB
app.post("/api/spin/reset", validateSpinRequest, async (req, res) => {
  try {
    const { uid } = req.body;
    
    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    // Delete user
    await User.deleteOne({ uid });
    
    // Delete user's spin history
    await SpinHistory.deleteMany({ uid });

    console.log(`🔄 User data DELETED from MongoDB: ${uid}`);
    
    res.json({
      success: true,
      message: "User data reset successfully"
    });
  } catch (error) {
    console.error('❌ Reset error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// ADMIN endpoint - Get all users (for debugging)
app.get("/api/spin/admin/users", async (req, res) => {
  try {
    // Basic admin authentication (you should enhance this)
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, message: "Admin access denied" });
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
    console.error('❌ Admin users error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// ADMIN endpoint - Reset daily free spins
app.post("/api/spin/admin/reset-daily", async (req, res) => {
  try {
    // Internal authentication
    const internalKey = req.headers['x-internal-key'];
    if (!internalKey || internalKey !== process.env.SPIN_INTERNAL_KEY) {
      return res.status(403).json({ success: false, message: "Internal access denied" });
    }

    // Compute 24-hour cutoff
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log(`🔄 Resetting daily spins for users inactive since: ${cutoff.toISOString()}`);

    // Update users who haven't spun in 24h or never spun
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

    console.log(`✅ Daily reset completed: ${result.modifiedCount} users updated`);

    res.json({
      success: true,
      message: "Daily free spins reset completed",
      updated_count: result.modifiedCount,
      matched_count: result.matchedCount
    });
  } catch (error) {
    console.error('❌ Reset daily error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// ADMIN endpoint - Send FCM notifications to eligible users (COMPATIBLE VERSION)
app.post("/api/spin/admin/run-notify", async (req, res) => {
  try {
    // Internal authentication
    const internalKey = req.headers['x-internal-key'];
    if (!internalKey || internalKey !== process.env.SPIN_INTERNAL_KEY) {
      return res.status(403).json({ success: false, message: "Internal access denied" });
    }

    // Check if Firebase Admin is available
    if (!admin) {
      return res.status(503).json({ 
        success: false, 
        message: "FCM not configured - Firebase Admin SDK not initialized" 
      });
    }

    // Find users with free spins and FCM tokens
    const users = await User.find({
      freeSpins: { $gt: 0 },
      fcm_tokens: { $exists: true, $not: { $size: 0 } }
    });

    console.log(`📱 Found ${users.length} users eligible for FCM notifications`);

    let notifiedCount = 0;
    let failedCount = 0;
    let totalMessagesSent = 0;

    // Send notifications to each user
    for (const user of users) {
      if (user.fcm_tokens && user.fcm_tokens.length > 0) {
        let userSuccess = 0;
        let userFailed = 0;
        
        // Try different Firebase methods based on what's available
        try {
          // METHOD 1: Try sendEach (newer Firebase versions)
          if (typeof admin.messaging().sendEach === 'function') {
            console.log(`🔧 Using sendEach() for user: ${user.uid}`);
            const messages = user.fcm_tokens.map(token => ({
              token: token,
              notification: {
                title: "🎰 Your Free Spin is Ready!",
                body: "Come back and spin the wheel to win amazing rewards!",
              },
              data: {
                type: "daily_spin_reminder",
                screen: "spin_wheel",
                uid: user.uid
              }
            }));
            
            const response = await admin.messaging().sendEach(messages);
            userSuccess = response.successCount;
            userFailed = response.failureCount;
          }
          // METHOD 2: Try sendMulticast (some versions)
          else if (typeof admin.messaging().sendMulticast === 'function') {
            console.log(`🔧 Using sendMulticast() for user: ${user.uid}`);
            const message = {
              notification: {
                title: "🎰 Your Free Spin is Ready!",
                body: "Come back and spin the wheel to win amazing rewards!",
              },
              tokens: user.fcm_tokens,
              data: {
                type: "daily_spin_reminder",
                screen: "spin_wheel",
                uid: user.uid
              }
            };
            
            const response = await admin.messaging().sendMulticast(message);
            userSuccess = response.successCount;
            userFailed = response.failureCount;
          }
          // METHOD 3: Try sendToDevice (older versions)
          else if (typeof admin.messaging().sendToDevice === 'function') {
            console.log(`🔧 Using sendToDevice() for user: ${user.uid}`);
            const payload = {
              notification: {
                title: "🎰 Your Free Spin is Ready!",
                body: "Come back and spin the wheel to win amazing rewards!",
              },
              data: {
                type: "daily_spin_reminder",
                screen: "spin_wheel",
                uid: user.uid
              }
            };
            
            const response = await admin.messaging().sendToDevice(user.fcm_tokens, payload);
            userSuccess = response.successCount;
            userFailed = response.failureCount;
          }
          // METHOD 4: Fallback - send individual messages
          else {
            console.log(`🔧 Using individual send() for user: ${user.uid}`);
            const promises = user.fcm_tokens.map(token => 
              admin.messaging().send({
                token: token,
                notification: {
                  title: "🎰 Your Free Spin is Ready!",
                  body: "Come back and spin the wheel to win amazing rewards!",
                },
                data: {
                  type: "daily_spin_reminder",
                  screen: "spin_wheel",
                  uid: user.uid
                }
              })
            );
            
            const results = await Promise.allSettled(promises);
            userSuccess = results.filter(r => r.status === 'fulfilled').length;
            userFailed = results.filter(r => r.status === 'rejected').length;
            
            // Clean up failed tokens
            if (userFailed > 0) {
              const failedTokens = [];
              results.forEach((result, index) => {
                if (result.status === 'rejected') {
                  failedTokens.push(user.fcm_tokens[index]);
                }
              });
              
              if (failedTokens.length > 0) {
                await User.updateOne(
                  { uid: user.uid },
                  { $pull: { fcm_tokens: { $in: failedTokens } } }
                );
                console.log(`🧹 Cleaned ${failedTokens.length} invalid tokens for ${user.uid}`);
              }
            }
          }
          
          totalMessagesSent += userSuccess;
          if (userSuccess > 0) notifiedCount++;
          if (userFailed > 0) failedCount++;
          
          console.log(`✅ User ${user.uid}: ${userSuccess} sent, ${userFailed} failed`);
          
        } catch (error) {
          failedCount++;
          console.error(`❌ Failed to notify user ${user.uid}:`, error.message);
        }
      }
    }

    console.log(`📊 Notification summary: ${notifiedCount} users notified, ${totalMessagesSent} messages sent, ${failedCount} users failed`);

    res.json({
      success: true,
      message: "FCM notifications processed",
      total_eligible: users.length,
      users_notified: notifiedCount,
      messages_sent: totalMessagesSent,
      users_failed: failedCount
    });
  } catch (error) {
    console.error('❌ Run notify error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
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
  
  // CORS error
  if (err.message.includes('CORS')) {
    return res.status(403).json({ 
      success: false, 
      message: "CORS policy violation" 
    });
  }
  
  // Rate limit error
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
  // In production, you might want to restart the process
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// =====================
// SERVER STARTUP
// =====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Premium Spin Wheel Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ CORS enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`🎯 Rewards configuration: ${rewardsConfig.length} rewards loaded`);
  console.log(`🛡️ Security: Helmet, Rate Limiting, Compression enabled`);
  console.log(`📱 FCM Admin Endpoints: /api/spin/admin/reset-daily, /api/spin/admin/run-notify`);
  
  // Better connection status check
  const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
  console.log(`💾 MongoDB: ${dbStatus}`);
  console.log(`🏷️ Cluster: AVIDERS-SPIN-WIN`);
  console.log(`🗃️ Database: spinwheelDb`);
  console.log(`🔑 Using: ${process.env.MONGO_URI_SPIN ? 'MONGO_URI_SPIN' : process.env.MONGO_URI ? 'MONGO_URI' : 'No connection string'}`);
  
  // Security warnings
  if (process.env.NODE_ENV === 'production' && allowedOrigins.includes('http://localhost:3000')) {
    console.log(`⚠️  WARNING: Localhost is in allowed origins in production`);
  }
});
