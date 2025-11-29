const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Basic CORS
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`, req.body || '');
  next();
});

// Health check - always works
app.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running", 
    timestamp: new Date().toISOString()
  });
});

// In-memory storage for demo (replace with database later)
const userSpins = new Map();

// Function to ensure user has data
const ensureUserData = (uid) => {
  if (!userSpins.has(uid)) {
    userSpins.set(uid, {
      free_spins: 1, // Always 1 free spin available
      bonus_spins: 0,
      wallet_coins: 100,
      last_spin: null
    });
  }
  return userSpins.get(uid);
};

// SPIN API ENDPOINTS
app.post("/api/spin/status", (req, res) => {
  const { uid } = req.body;
  console.log(`🔎 STATUS requested for UID: ${uid}`);
  
  if (!uid) {
    return res.json({
      success: false,
      message: "UID is required"
    });
  }

  const userData = ensureUserData(uid);
  
  res.json({
    success: true,
    free_spin_available: userData.free_spins > 0,
    bonus_spins: userData.bonus_spins,
    wallet_coins: userData.wallet_coins,
    rewards: [
      { type: "coins", value: 10, label: "10 Coins" },
      { type: "coins", value: 20, label: "20 Coins" },
      { type: "coins", value: 5, label: "5 Coins" },
      { type: "none", value: 0, label: "Try Again" },
      { type: "coins", value: 15, label: "15 Coins" },
      { type: "coupon", code: "SPIN10", label: "Discount Coupon" },
      { type: "coins", value: 25, label: "25 Coins" },
      { type: "none", value: 0, label: "Better Luck" }
    ],
    message: "Status loaded successfully"
  });
});

app.post("/api/spin/bonus", (req, res) => {
  const { uid } = req.body;
  console.log(`➕ BONUS requested for UID: ${uid}`);
  
  if (!uid) {
    return res.json({
      success: false,
      message: "UID is required"
    });
  }

  const userData = ensureUserData(uid);
  userData.bonus_spins += 1;
  
  console.log(`✅ Bonus spin added. Total bonus spins: ${userData.bonus_spins}`);
  
  res.json({
    success: true,
    bonus_spins: userData.bonus_spins,
    message: "Bonus spin added successfully!"
  });
});

app.post("/api/spin/spin", (req, res) => {
  const { uid } = req.body;
  console.log(`🎰 SPIN requested for UID: ${uid}`);
  
  if (!uid) {
    return res.json({
      success: false,
      message: "UID is required"
    });
  }

  const userData = ensureUserData(uid);
  
  // Check if user has spins
  const totalSpins = userData.free_spins + userData.bonus_spins;
  if (totalSpins <= 0) {
    return res.json({
      success: false,
      message: "No spins available"
    });
  }

  // Use free spin first, then bonus spins
  let free_spin_used = false;
  if (userData.free_spins > 0) {
    userData.free_spins -= 1;
    free_spin_used = true;
    console.log(`🔄 Used free spin. Remaining: ${userData.free_spins}`);
  } else {
    userData.bonus_spins -= 1;
    console.log(`🔄 Used bonus spin. Remaining: ${userData.bonus_spins}`);
  }

  // Generate reward
  const rewards = [
    { type: "coins", value: 10, label: "10 Coins", sector: 0 },
    { type: "coins", value: 20, label: "20 Coins", sector: 1 },
    { type: "coins", value: 5, label: "5 Coins", sector: 2 },
    { type: "none", value: 0, label: "Try Again", sector: 3 },
    { type: "coins", value: 15, label: "15 Coins", sector: 4 },
    { type: "coupon", code: "SPIN" + Math.random().toString(36).substring(2, 6).toUpperCase(), label: "Discount Coupon", sector: 5 },
    { type: "coins", value: 25, label: "25 Coins", sector: 6 },
    { type: "none", value: 0, label: "Better Luck", sector: 7 }
  ];
  
  const randomIndex = Math.floor(Math.random() * rewards.length);
  const reward = rewards[randomIndex];
  
  // Update wallet if coins reward
  if (reward.type === "coins") {
    userData.wallet_coins += reward.value;
    console.log(`💰 Added ${reward.value} coins. Total: ${userData.wallet_coins}`);
  }
  
  userData.last_spin = new Date();
  
  res.json({
    success: true,
    sector: reward.sector,
    reward: reward,
    free_spin_used_today: free_spin_used,
    bonus_spins: userData.bonus_spins,
    wallet_coins: userData.wallet_coins,
    message: `You won: ${reward.label}`
  });
});

// Reset free spins endpoint (for testing)
app.post("/api/spin/reset", (req, res) => {
  const { uid } = req.body;
  if (uid && userSpins.has(uid)) {
    userSpins.get(uid).free_spins = 1;
    userSpins.get(uid).bonus_spins = 0;
  }
  res.json({ success: true, message: "Spins reset" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 SERVER RUNNING on port ${PORT}`);
  console.log(`✅ Health check: https://your-app.onrender.com/health`);
  console.log(`✅ Spin endpoints ready!`);
  console.log(`🎯 Every user gets 1 free spin + bonus spins from ads`);
});
