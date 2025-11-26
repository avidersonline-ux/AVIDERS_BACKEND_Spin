const SpinUser = require("../models/spinUser.model");
const Spin = require("../models/spin.model");
const WalletLedger = require("../models/wallet.model");
const { generateReward } = require("../utils/spin_rewards");

async function processSpin(uid, email) {
  let user = await SpinUser.findOne({ uid });

  if (!user) {
    user = await SpinUser.create({
      uid,
      email,
      spin_balance: 0,
      coins: 0,
      free_spin_used_today: false,
      last_spin_date: null
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Reset free spin daily
  if (user.last_spin_date !== today) {
    user.free_spin_used_today = false;
    user.last_spin_date = today;
  }

  // Determine spin source
  let source;
  if (!user.free_spin_used_today) {
    user.free_spin_used_today = true;
    source = "free";
  }
  else if (user.spin_balance > 0) {
    user.spin_balance -= 1;
    source = "bonus";
  }
  else {
    return { error: "NO_SPINS_LEFT" };
  }

  // Generate reward
  const reward = generateReward();

  if (reward.type === "coins") {
    user.coins += reward.value;

    await WalletLedger.create({
      userUid: uid,
      userEmail: email,
      type: "spin_reward",
      amount: reward.value,
      description: `Won ${reward.value} coins from spin`
    });
  }

  user.rewards.push({
    type: reward.type,
    value: reward.value,
    code: reward.code,
    createdAt: new Date()
  });

  await user.save();

  await Spin.create({
    userUid: uid,
    userEmail: email,
    reward,
    source
  });

  return {
    type: reward.type,
    value: reward.value,
    code: reward.code,
    free_spin_used_today: user.free_spin_used_today,
    bonus_spins_left: user.spin_balance
  };
}

async function getStatus(uid) {
  const user = await SpinUser.findOne({ uid });

  if (!user) {
    return {
      freeSpinAvailable: true,
      bonusSpins: 0,
      walletCoins: 0
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const freeSpinAvailable = (user.last_spin_date !== today) || (!user.free_spin_used_today);

  return {
    freeSpinAvailable,
    bonusSpins: user.spin_balance,
    walletCoins: user.coins
  };
}

module.exports = {
  processSpin,
  getStatus
};
