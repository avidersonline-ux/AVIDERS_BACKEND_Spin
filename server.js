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
    message: "Server is running in emergency mode", 
    timestamp: new Date().toISOString(),
    database: "fallback"
  });
});

// Test endpoint with full mock data
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API is working in emergency mode!",
    rewards: [
      { type: "coins", value: 10, label: "10 Coins", probability: 0.3 },
      { type: "coins", value: 20, label: "20 Coins", probability: 0.2 },
      { type: "coins", value: 5, label: "5 Coins", probability: 0.4 },
      { type: "none", value: 0, label: "Try Again", probability: 0.05 },
      { type: "coins", value: 15, label: "15 Coins", probability: 0.25 },
      { type: "coupon", code: "TEST10", label: "Discount Coupon", probability: 0.1 },
      { type: "coins", value: 25, label: "25 Coins", probability: 0.15 },
      { type: "none", value: 0, label: "Better Luck", probability: 0.05 }
    ]
  });
});

// EMERGENCY SPIN API ENDPOINTS (No database required)
app.post("/api/spin/status", (req, res) => {
  const { uid } = req.body;
  console.log(`🔎 STATUS requested for UID: ${uid}`);
  
  res.json({
    success: true,
    free_spin_available: true,
    bonus_spins: 1,
    wallet_coins: 100,
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
    message: "Emergency mode - using mock data"
  });
});

app.post("/api/spin/bonus", (req, res) => {
  const { uid } = req.body;
  console.log(`➕ BONUS requested for UID: ${uid}`);
  
  res.json({
    success: true,
    bonus_spins_left: 2,
    message: "Bonus spin added! (Emergency mode)"
  });
});

app.post("/api/spin/spin", (req, res) => {
  const { uid } = req.body;
  console.log(`🎰 SPIN requested for UID: ${uid}`);
  
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
  
  res.json({
    success: true,
    sector: reward.sector,
    reward: reward,
    free_spin_used_today: false,
    bonus_spins_left: 1,
    wallet_coins: 100 + (reward.value || 0),
    message: `You won: ${reward.label} (Emergency mode)`
  });
});

// Try to load databases but don't crash if they fail
console.log('🔄 Attempting to load databases...');
try {
  const connectMongo = require("./config/mongo");
  connectMongo();
  console.log('✅ MongoDB module loaded');
} catch (error) {
  console.log('⚠️  MongoDB module failed to load:', error.message);
}

// If original routes exist, try to load them (but we already have emergency routes above)
try {
  const spinRoutes = require("./modules/spinwheel-service/routes/spin.routes");
  app.use("/api/spin", spinRoutes);
  console.log("✅ Original spin routes loaded");
} catch (error) {
  console.log("⚠️  Original spin routes not available, using emergency routes");
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 SERVER RUNNING on port ${PORT}`);
  console.log(`✅ Health check: https://your-app.onrender.com/health`);
  console.log(`✅ Test endpoint: https://your-app.onrender.com/api/test`);
  console.log(`✅ Spin endpoints ready in EMERGENCY MODE`);
  console.log(`📝 Make sure MONGODB_URI is set in Render environment variables`);
});
