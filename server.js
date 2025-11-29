const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Basic CORS
app.use(cors());
app.use(express.json());

// Health check - always works
app.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running", 
    timestamp: new Date().toISOString() 
  });
});

// Simple test endpoint
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API is working!",
    rewards: [
      "10 Coins", "20 Coins", "5 Coins", "Try Again", 
      "15 Coins", "Coupon", "25 Coins", "Better Luck"
    ]
  });
});

// Try to load databases and routes, but don't crash if they fail
try {
  const connectMongo = require("./config/mongo");
  const connectSpinMongo = require("./modules/spinwheel-service/config/mongo.spin");
  
  connectMongo();      
  connectSpinMongo();
  
  // Try to load spin routes
  app.use("/api/spin", require("./modules/spinwheel-service/routes/spin.routes"));
  console.log("✅ Spin routes loaded");
} catch (error) {
  console.log("⚠️  Some modules failed to load, but server is running:", error.message);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`✅ Test endpoint: http://localhost:${PORT}/api/test`);
});
