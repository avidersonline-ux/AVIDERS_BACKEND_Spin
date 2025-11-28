// config/mongo.js

const mongoose = require("mongoose");

module.exports = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI, {});
    console.log("✅ Main MongoDB Connected");
  } catch (err) {
    console.error("❌ Main MongoDB Error:", err.message);
    process.exit(1);
  }
};
