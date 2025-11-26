const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  // ⭐ Firebase UID (Google Sign-In / Phone OTP)
  firebaseUid: { type: String, unique: true, sparse: true },

  // ⭐ Primary Email (Used for merging accounts)
  email: { type: String, unique: true, required: true },

  // Username (fallback based on email)
  username: { type: String },

  // For email/password login only
  passwordHash: { type: String },

  // User Profile
  name: { type: String, default: "" },
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  phone: { type: String, default: "" },

  provider: { type: String, default: "email" }, // email | google | firebase
  verified: { type: Boolean, default: false },

  // -------------------------------
  // ⭐ Spin Wheel / AVD Gamification
  // -------------------------------
  spin_balance: { type: Number, default: 0 },
  last_spin_date: { type: String, default: "" },
  coins: { type: Number, default: 0 },

  rewards: [
    {
      type: { type: String },
      value: Number,
      code: String,
      createdAt: { type: Date, default: Date.now }
    }
  ],

  // Meta
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
