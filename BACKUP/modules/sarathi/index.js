require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const pricingRoutes = require("./routes/pricing.routes");
const tripRoutes = require("./routes/trips.routes");

const app = express();
app.use(cors());
app.use(express.json());

// DB Connect
connectDB();

// Routes
app.use("/sarathi/pricing", pricingRoutes);
app.use("/sarathi/trips", tripRoutes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Sarathi AVD Backend running on port ${PORT}`);
});
