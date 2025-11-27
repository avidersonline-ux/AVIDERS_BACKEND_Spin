// modules/spinwheel-service/config/mongo.spin.js

const mongoose = require("mongoose");

module.exports = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI_SPIN, {
      // ❌ DO NOT use useNewUrlParser or useUnifiedTopology (removed in Mongoose v7+)
      // Mongoose now uses correct defaults automatically
    });

    console.log("✅ Spin DB Connected");
  } catch (err) {
    console.error("❌ Spin DB Error:", err);
    process.exit(1);
  }
};
