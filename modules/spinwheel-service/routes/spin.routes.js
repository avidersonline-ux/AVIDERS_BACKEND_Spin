const router = require("express").Router();
const SpinUser = require("../models/SpinUser");
const { pickReward, loadConfig } = require("../utils/rewardEngine");

// 🟢 GET STATUS
router.get("/status", async (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).json({ success: false, message: "UID is required" });

  let user = await SpinUser.findOne({ userId: uid });
  if (!user) user = await SpinUser.create({ userId: uid });

  const today = new Date().toDateString();
  const lastSpin = user.lastSpinDate ? user.lastSpinDate.toDateString() : null;

  const freeSpinAvailable = lastSpin !== today;
  const config = loadConfig();

  res.json({
    success: true,
    free_spin_available: freeSpinAvailable,
    bonus_spins: user.bonusSpins,
    wallet_coins: user.walletCoins,
    rewards: config.rewards
  });
});

// 🟠 POST BONUS SPIN
router.post("/bonus", async (req, res) => {
  const uid = req.body.uid;
  if (!uid) return res.status(400).json({ success: false, message: "UID is required" });

  const user = await SpinUser.findOneAndUpdate(
    { userId: uid },
    { $inc: { bonusSpins: 1 } },
    { new: true }
  );

  res.json({ success: true, bonus_spins_left: user.bonusSpins });
});

// 🔴 POST SPIN
router.post("/spin", async (req, res) => {
  const uid = req.body.uid;
  if (!uid) return res.status(400).json({ success: false, message: "UID is required" });

  let user = await SpinUser.findOne({ userId: uid });
  if (!user) user = await SpinUser.create({ userId: uid });

  const today = new Date().toDateString();
  const lastSpin = user.lastSpinDate ? user.lastSpinDate.toDateString() : null;

  const freeSpinAvailable = lastSpin !== today;
  let usingFreeSpin = false;

  if (freeSpinAvailable) {
    usingFreeSpin = true;
  } else if (user.bonusSpins > 0) {
    user.bonusSpins -= 1;
  } else {
    return res.status(400).json({ success: false, message: "No spins left" });
  }

  const { index, reward } = pickReward();

  if (reward.type === "coins") {
    user.walletCoins += reward.value;
  }

  user.lastSpinDate = new Date();
  await user.save();

  res.json({
    success: true,
    sector: index,
    reward,
    bonus_spins_left: user.bonusSpins,
    free_spin_used_today: !usingFreeSpin
  });
});

module.exports = router;
