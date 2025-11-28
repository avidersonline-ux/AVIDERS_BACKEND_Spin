const mongoose = require("mongoose");

const connectSpinDB = async () => {
  const uri = process.env.MONGO_URI_SPIN; // MUST COME FROM RENDER ENV

  if (!uri) {
    console.error("❌ MONGO_URI_SPIN is missing");
    process.exit(1);
  }

  try {
    await mongoose.createConnection(uri, {
      dbName: "spinwheelDb",
    });
    console.log("🟢 SpinWheel MongoDB Connected");
  } catch (err) {
    console.error("🔴 SpinWheel DB Error:", err.message);
  }
};

module.exports = connectSpinDB;
