require("dotenv").config();
const express = require("express");
const cors = require("cors");
const firebase = require("./config/firebase");

// DB Connections
const connectSpinDB = require("./config/mongo.spin");
const connectSarathiDB = require("./config/mongo.sarathi");

connectSpinDB();
connectSarathiDB();

const app = express();
app.use(cors());
app.use(express.json());

// MODULE ROUTES
const spinRoutes = require("./modules/spinwheel-service/routes/spin.routes");

// base API
app.use("/api/spin", spinRoutes);

// Health
app.get("/", (req, res) => res.send("Aviders Backend Running"));

// Error handler
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// Port
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Backend running on PORT ${PORT}`);
});
