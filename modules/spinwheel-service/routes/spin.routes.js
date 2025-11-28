const express = require("express");
const router = express.Router();

const SpinUser = require("../models/SpinUser");
const { pickReward, loadConfig } = require("../engine/rewardEngine");

// ✅ FIXED — accept uid or userId from Flutter
function getUID(req) {
  return (
    req.headers["x-user-id"] ||
    req.body.uid ||               // <-- Flutter sends this
    req.body.userId ||            // fallback
    null
  );
}

// ---------------------- STATUS ----------------------
router.post("/status", async (req, res) => {
  const userId = getUID(req);

  console.log("🔎 STATUS UID RECEIVED →", userId, "BODY:", req.body);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "UID is required",
    });
  }

  let user = await SpinUser.findOne({ userId });
  if (!user) {
    user = await SpinUser.create({
      userId,
      bonusSpins: 0,
      walletCoins: 0,
      lastSpinDate: null,
    });
  }

  const config = loadConfig();

  const today = new Date().toDateString();
  const freeSpinAvailable =
    !user.lastSpinDate ||
    new Date(user.lastSpinDate).toDateString() !== today;

  return res.json({
    success: true,
    free_spin_available: freeSpinAvailable,
    bonus_spins: user.bonusSpins,
    wallet_coins: user.walletCoins,
    rewards: config.rewards, // ✅ FIXED — correct field
  });
});

// ---------------------- BONUS SPIN ----------------------
router.post("/bonus", async (req, res) => {
  const userId = getUID(req);

  console.log("➕ BONUS UID RECEIVED →", userId);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "UID is required",
    });
  }

  let user = await SpinUser.findOne({ userId });
  if (!user) user = await SpinUser.create({ userId });

  user.bonusSpins += 1;
  await user.save();

  return res.json({
    success: true,
    bonus_spins_left: user.bonusSpins,
  });
});

// ---------------------- SPIN NOW ----------------------
router.post("/spin", async (req, res) => {
  const userId = getUID(req);

  console.log("🎯 SPIN UID RECEIVED →", userId);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "UID is required",
    });
  }

  let user = await SpinUser.findOne({ userId });
  if (!user) user = await SpinUser.create({ userId });

  const today = new Date().toDateString();
  let usedFreeSpinToday = false;

  if (!user.lastSpinDate || new Date(user.lastSpinDate).toDateString() !== today) {
    usedFreeSpinToday = false;
    user.lastSpinDate = new Date();
  } else {
    if (user.bonusSpins <= 0) {
      return res.json({ success: false, message: "No spins left" });
    }
    usedFreeSpinToday = true;
    user.bonusSpins -= 1;
  }

  const { sectorIndex, reward } = pickReward();

  if (reward.type === "coins") {
    user.walletCoins += reward.value;
  }

  await user.save();

  return res.json({
    success: true,
    sector: sectorIndex,
    reward,
    free_spin_used_today: !usedFreeSpinToday,
    bonus_spins_left: user.bonusSpins,
    wallet_coins: user.walletCoins,
  });
});

module.exports = router;
