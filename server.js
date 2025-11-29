const express = require("express");
const cors = require("cors");

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: false
}));

app.use(express.json());

// Simple in-memory storage (works without MongoDB)
const users = new Map();
const spinHistory = [];

// Request logging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`, req.body || '');
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running", 
    timestamp: new Date().toISOString(),
    storage: "In-memory (No MongoDB needed)"
  });
});

// Ensure user exists
const ensureUser = (uid) => {
  if (!users.has(uid)) {
    users.set(uid, {
      uid: uid,
      freeSpins: 1,
      bonusSpins: 0,
      walletCoins: 100,
      lastSpin: null,
      createdAt: new Date()
    });
    console.log(`👤 New user created: ${uid}`);
  }
  return users.get(uid);
};

// SPIN API ENDPOINTS
app.post("/api/spin/status", (req, res) => {
  try {
    const { uid } = req.body;
    console.log(`🔎 STATUS requested for UID: ${uid}`);
    
    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    const user = ensureUser(uid);
    
    res.json({
      success: true,
      free_spin_available: user.freeSpins > 0,
      bonus_spins: user.bonusSpins,
      wallet_coins: user.walletCoins,
      rewards: [
        { type: "coins", value: 100, label: "100 AVIDERS" },
        { type: "coins", value: 200, label: "200 AVIDERS" },
        { type: "coins", value: 50, label: "50 AVIDERS" },
        { type: "none", value: 0, label: "Try Again" },
        { type: "coins", value: 150, label: "150 AVIDERS" },
        { type: "coupon", code: "AVIDERS100", label: "Premium Coupon" },
        { type: "coins", value: 300, label: "300 AVIDERS" },
        { type: "none", value: 0, label: "Better Luck" }
      ]
    });
  } catch (error) {
    console.error('❌ Status error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

app.post("/api/spin/bonus", (req, res) => {
  try {
    const { uid } = req.body;
    console.log(`➕ BONUS requested for UID: ${uid}`);
    
    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    const user = ensureUser(uid);
    user.bonusSpins += 1;

    console.log(`✅ Bonus spin added for ${uid}. Total: ${user.bonusSpins}`);
    
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

app.post("/api/spin/spin", (req, res) => {
  try {
    const { uid } = req.body;
    console.log(`🎰 SPIN requested for UID: ${uid}`);
    
    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    const user = ensureUser(uid);
    
    // Check if user has spins
    if (user.freeSpins <= 0 && user.bonusSpins <= 0) {
      return res.json({ success: false, message: "No spins available" });
    }

    // Use free spin first, then bonus spins
    let freeSpinUsed = false;
    
    if (user.freeSpins > 0) {
      user.freeSpins -= 1;
      freeSpinUsed = true;
    } else {
      user.bonusSpins -= 1;
    }

    user.lastSpin = new Date();

    // Generate reward - Premium AVIDERS amounts
    const rewards = [
      { type: "coins", value: 100, label: "100 AVIDERS", sector: 0 },
      { type: "coins", value: 200, label: "200 AVIDERS", sector: 1 },
      { type: "coins", value: 50, label: "50 AVIDERS", sector: 2 },
      { type: "none", value: 0, label: "Try Again", sector: 3 },
      { type: "coins", value: 150, label: "150 AVIDERS", sector: 4 },
      { type: "coupon", code: "AVD" + Math.random().toString(36).substring(2, 6).toUpperCase(), label: "Premium Coupon", sector: 5 },
      { type: "coins", value: 300, label: "300 AVIDERS", sector: 6 },
      { type: "none", value: 0, label: "Better Luck", sector: 7 }
    ];
    
    const randomIndex = Math.floor(Math.random() * rewards.length);
    const reward = rewards[randomIndex];
    
    // Update wallet if coins reward
    if (reward.type === "coins") {
      user.walletCoins += reward.value;
    }

    // Save spin history
    const historyEntry = {
      uid: uid,
      reward_type: reward.type,
      reward_value: reward.value,
      reward_code: reward.code,
      reward_label: reward.label,
      timestamp: new Date()
    };
    spinHistory.push(historyEntry);

    console.log(`✅ Spin completed for ${uid}. Reward: ${reward.label}, AVIDERS: ${user.walletCoins}`);
    
    res.json({
      success: true,
      sector: reward.sector,
      reward: reward,
      free_spin_used_today: freeSpinUsed,
      bonus_spins: user.bonusSpins,
      wallet_coins: user.walletCoins,
      message: `You won: ${reward.label}`
    });
  } catch (error) {
    console.error('❌ Spin error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// LEDGER endpoint - Get user history
app.post("/api/spin/ledger", (req, res) => {
  try {
    const { uid } = req.body;
    
    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    const user = ensureUser(uid);
    const userHistory = spinHistory
      .filter(record => record.uid === uid)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);

    res.json({
      success: true,
      user: {
        uid: user.uid,
        freeSpins: user.freeSpins,
        bonusSpins: user.bonusSpins,
        walletCoins: user.walletCoins,
        createdAt: user.createdAt
      },
      spinHistory: userHistory,
      totalSpins: userHistory.length
    });
  } catch (error) {
    console.error('❌ Ledger error:', error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
});

// RESET endpoint (for testing)
app.post("/api/spin/reset", (req, res) => {
  try {
    const { uid } = req.body;
    
    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    if (users.has(uid)) {
      users.delete(uid);
    }
    
    // Remove user history
    const userHistoryIndexes = [];
    spinHistory.forEach((record, index) => {
      if (record.uid === uid) {
        userHistoryIndexes.push(index);
      }
    });
    
    // Remove in reverse order to avoid index issues
    userHistoryIndexes.reverse().forEach(index => {
      spinHistory.splice(index, 1);
    });

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Premium Spin Wheel Server running on port ${PORT}`);
  console.log(`✅ CORS enabled for all origins`);
  console.log(`💾 Using in-memory storage (No MongoDB required)`);
  console.log(`🌍 Server is ready at: https://aviders-backend-spin-1.onrender.com`);
});
