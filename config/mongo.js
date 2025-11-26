const mongoose = require("mongoose");

const connectMongo = async () => {
  try {
    console.log("MONGO_URI:", process.env.MONGO_URI);  // Debug line

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("🟢 MongoDB Connected (SpinWheel)");
  } catch (err) {
    console.error("🔴 MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};

module.exports = connectMongo;


