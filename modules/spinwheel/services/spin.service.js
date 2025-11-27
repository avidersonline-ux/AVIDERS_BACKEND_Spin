// modules/spinwheel-service/services/spin.service.js

const fs = require("fs");
const path = require("path");

const SpinUser = require("../models/SpinUser");
const SpinHistory = require("../models/SpinHistory");
const Spin = require("../models/Spin");

class SpinService {
  constructor() {
    const filePath = path.join(__dirname, "../config/rewards.config.json");
    const raw = fs.readFileSync(filePath);
    this.config = JSON.parse(raw);

    this.sectors = this.config.sectors;
  }

  // --------------------------------------------------------
  // GET STATUS
  // --------------------------------------------------------
  async getStatus(uid) {
    let user = await SpinUser.findOne({ uid });

    if (!user) {
      user = await SpinUser.create({ uid });
    }

    const today = new Date().toDateString();
    const lastSpin =
      user.last_spin_date ? new Date(user.last_spin_date).toDateString() : null;

    const freeSpinAvailable = lastSpin !== today;

    return {
      success: true,
      free_spin_available: freeSpinAvailable,
      bonus_spins: user.spin_balance,
      wallet_coins: user.coins,
      rewards: this.sectors,
    };
  }

  // --------------------------------------------------------
  // ADD BONUS SPIN
  // --------------------------------------------------------
  async giveBonus(uid) {
    const user = await SpinUser.findOne({ uid });

    user.spin_balance += 1;
    await user.save();

    return {
      success: true,
      bonus_spins_left: user.spin_balance,
    };
  }

  // --------------------------------------------------------
  // SPIN NOW
  // --------------------------------------------------------
  async spinNow(uid, email) {
    let user = await SpinUser.findOne({ uid });

    if (!user) {
      user = await SpinUser.create({ uid, email });
    }

    const today = new Date().toDateString();
    const lastSpin =
      user.last_spin_date ? new Date(user.last_spin_date).toDateString() : null;

    const freeSpinAvailable = lastSpin !== today;

    if (!freeSpinAvailable && user.spin_balance <= 0) {
      return { success: false, message: "No spins left" };
    }

    if (!freeSpinAvailable) {
      user.spin_balance -= 1;
    }

    user.last_spin_date = today;

    // Pick a random reward
    const index = Math.floor(Math.random() * this.sectors.length);
    const rewardObj = this.sectors[index];

    // If coins, update wallet
    if (rewardObj.type === "coins") {
      user.coins += rewardObj.value;
    }

    await user.save();

    // Log spin
    await Spin.create({
      uid,
      email,
      reward: rewardObj,
      source: freeSpinAvailable ? "daily" : "bonus",
    });

    return {
      success: true,
      reward: rewardObj,
      sector: index,
      bonus_spins_left: user.spin_balance,
      free_spin_used_today: freeSpinAvailable,
    };
  }
}

module.exports = new SpinService();
