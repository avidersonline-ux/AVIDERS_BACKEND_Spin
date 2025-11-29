const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectMongo = require("./config/mongo");
const connectSpinMongo = require("./modules/spinwheel-service/config/mongo.spin");

// Connect BOTH databases
connectMongo();      
connectSpinMongo();

const app = express();

// CORS configuration - IMPORTANT for mobile apps
app.use(cors({
  origin: true, // Allows all origins, you can restrict this later
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running", 
    timestamp: new Date().toISOString() 
  });
});

// API routes
app.use("/api/spin", require("./modules/spinwheel-service/routes/spin.routes"));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
