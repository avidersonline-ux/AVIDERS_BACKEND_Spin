require("dotenv").config();
const express = require("express");
const cors = require("cors");

const connectSpinDB = require("./modules/spinwheel-service/config/mongo.spin");
connectSpinDB();

const app = express();
app.use(cors());
app.use(express.json());

const spinRoutes = require("./modules/spinwheel-service/routes/spin.routes");
app.use("/api/spin", spinRoutes);

app.get("/", (req, res) => res.send("Aviders Spin Backend Running"));

const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Spin Backend running on PORT ${PORT}`)
);
