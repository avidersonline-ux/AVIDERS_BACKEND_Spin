// modules/spinwheel-service/services/spin.service.js

const SpinUser = require("../models/spinUser.model");
const SpinHistory = require("../models/SpinHistory");
const Spin = require("../models/spin.model");

const rewardsConfig = require("../config/rewards.config.json");

// ---------------------------------------
// GET STATUS
// ---------------------------------------
exports.getStatus = async (uid) => {
  let user = await SpinUser.findOne({ uid });

  if (!user) {
    user = await SpinUser.create({
      uid,
      email: "",
      spin_balance: 1,
      free_spin_used_today: false,
      coins: 0
    });
  }

  return {
    success: true,
    free_spin_used_today: user.free_spin_used_today,
    bonus_spins_left: user.spin_balance,
    coins: user.coins,
    rewards: rewardsConfig.rewards
  };
};

// ---------------------------------------
// SPIN NOW
// ---------------------------------------
exports.spinNow = async (uid, email) => {
  let user = await SpinUser.findOne({ uid });

  if (!user) {
    user = await SpinUser.create({
      uid,
      email,
      spin_balance: 1,
      free_spin_used_today: false,
      coins: 0
    });
  }

  // Daily free spin logic
  if (!user.free_spin_used_today) {
    user.free_spin_used_today = true;
  } else if (user.spin_balance > 0) {
    user.spin_balance -= 1;
  } else {
    return { success: false, message: "No spins left" };
  }

  // Select reward based on probability
  const reward = pickReward(rewardsConfig.rewards);

  // Apply reward result
  if (reward.type === "coins") {
    user.coins += reward.value;
  }

  await user.save();

  // Save history
  await SpinHistory.create({
    uid,
    email,
    reward: reward.label,
    reward_value: reward.value,
    created_at: new Date()
  });

  return {
    success: true,
    reward,
    sector: reward.sector,
    free_spin_used_today: user.free_spin_used_today,
    bonus_spins_left: user.spin_balance
  };
};

// ---------------------------------------
// PICK REWARD (Probability based)
// ---------------------------------------
function pickReward(rewards) {
  const total = rewards.reduce((sum, r) => sum + r.probability, 0);
  let random = Math.random() * total;

  for (let reward of rewards) {
    if (random < reward.probability) {
      return reward;
    }
    random -= reward.probability;
  }

  return rewards[rewards.length - 1];
}
