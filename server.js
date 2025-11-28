const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectMongo = require("./config/mongo");

connectMongo();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/spin", require("./routes/spinRoutes"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Spin API running on port ${PORT}`));
