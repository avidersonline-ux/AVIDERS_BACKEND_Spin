const mongoose = require("mongoose");

const spinUserSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true
  },
  free_spin_available: {
    type: Boolean,
    default: true
  },
  bonus_spins: {
    type: Number,
    default: 0
  },
  last_free_spin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("SpinUser", spinUserSchema);
