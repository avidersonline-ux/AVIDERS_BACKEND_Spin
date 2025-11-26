const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectMongo = require("./config/mongo");
connectMongo();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", require("./routes/index"));

// Error handler last
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Backend running on ${PORT} and reachable on LAN`);
});

