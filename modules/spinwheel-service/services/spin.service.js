// modules/spinwheel-service/services/spin.service.js

const SpinUser = require("../models/SpinUser");
const SpinHistory = require("../models/SpinHistory");
const Spin = require("../models/Spin");

const { pickReward, loadConfig } = require("../utils/rewardEngine");

class SpinService {

  async getStatus(uid) {
    let user = await SpinUser.findOne({ uid });
    if (!user) user = await SpinUser.create({ uid });

    const today = new Date().toDateString();
    const lastSpin = user.last_spin_date ? new Date(user.last_spin_date).toDateString() : null;

    return {
      success: true,
      free_spin_available: lastSpin !== today,
      bonus_spins: user.spin_balance,
      wallet_coins: user.coins,
      rewards: loadConfig().sectors   // dynamic
    };
  }

  async spinNow(uid, email) {
    let user = await SpinUser.findOne({ uid });
    if (!user) user = await SpinUser.create({ uid, email });

    const today = new Date().toDateString();
    const lastSpin = user.last_spin_date ? new Date(user.last_spin_date).toDateString() : null;
    const freeSpinAvailable = lastSpin !== today;

    if (!freeSpinAvailable && user.spin_balance <= 0) {
      return { success: false, message: "No spins left" };
    }

    if (!freeSpinAvailable) user.spin_balance -= 1;
    user.last_spin_date = today;

    const { sectorIndex, reward } = pickReward();

    if (reward.type === "coins") user.coins += reward.value;

    await user.save();

    await Spin.create({
      uid,
      email,
      reward,
      source: freeSpinAvailable ? "daily" : "bonus"
    });

    return {
      success: true,
      reward,
      sector: sectorIndex,
      bonus_spins_left: user.spin_balance,
      free_spin_used_today: freeSpinAvailable
    };
  }
}

module.exports = new SpinService();
