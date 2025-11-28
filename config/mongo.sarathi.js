const mongoose = require("mongoose");

module.exports = async function connectSarathiDB() {
  try {
    await mongoose.createConnection(process.env.MONGO_SARATHI_URI);
    console.log("🟢 Sarathi DB connected");
  } catch (err) {
    console.error("🔴 Sarathi DB error:", err.message);
  }
};
