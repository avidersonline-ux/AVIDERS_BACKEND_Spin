const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectMongo = require("./config/mongo");
const connectSpinMongo = require("./modules/spinwheel-service/config/mongo.spin");

// connect BOTH databases
connectMongo();      
connectSpinMongo();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/spin", require("./modules/spinwheel-service/routes/spin.routes"));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
