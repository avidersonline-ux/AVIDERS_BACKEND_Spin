// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Only Spin DB
const connectSpinDB = require("./modules/spinwheel-service/config/mongo.spin");
connectSpinDB();

const app = express();
app.use(cors());
app.use(express.json());

// Spinwheel routes module
const spinRoutes = require("./modules/spinwheel-service/routes/spin.routes");

// Base API
app.use("/api/spin", spinRoutes);

// Health check
app.get("/", (req, res) => res.send("Aviders Spin Backend Running"));

// Error handler
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Spin Backend running on PORT ${PORT}`)
);
