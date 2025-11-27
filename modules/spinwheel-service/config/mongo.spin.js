const mongoose = require("mongoose");

module.exports = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI_SPIN);

    console.log("✅ Spin DB Connected");
  } catch (err) {
    console.error("❌ Spin DB Error:", err);
    process.exit(1);
  }
};
