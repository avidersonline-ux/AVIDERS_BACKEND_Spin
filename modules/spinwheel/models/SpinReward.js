const mongoose = require("mongoose");

const SpinRewardSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: Number, required: true },
  chance: { type: Number, required: true },
});

module.exports = mongoose.model("SpinReward", SpinRewardSchema);
