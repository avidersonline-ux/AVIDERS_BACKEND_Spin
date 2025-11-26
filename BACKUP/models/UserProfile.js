const mongoose = require("mongoose");

const UserProfileSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },  // Firebase UID
  email: { type: String, required: true },

  name: { type: String },
  phone: { type: String },
  photoUrl: { type: String },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("UserProfile", UserProfileSchema);
