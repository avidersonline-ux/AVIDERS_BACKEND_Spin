const SpinUser = require("../models/SpinUser");

exports.watchAd = async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ message: "UID required" });

    let user = await SpinUser.findOne({ uid });
    if (!user)
      user = await SpinUser.create({ uid });

    // Reset daily ad count if needed
    const today = new Date().toDateString();
    const lastReset = user.reward_ads_last_reset
      ? user.reward_ads_last_reset.toDateString()
      : null;

    if (today !== lastReset) {
      user.reward_ads_used_today = 0;
      user.reward_ads_last_reset = new Date();
    }

    // Max 10 ads per day
    if (user.reward_ads_used_today >= 10) {
      return res.status(403).json({
        allowed: false,
        message: "Daily ad limit reached",
      });
    }

    // Add a spin
    user.spin_balance += 1;
    user.reward_ads_used_today += 1;

    await user.save();

    res.json({
      allowed: true,
      message: "Reward spin added",
      spin_balance: user.spin_balance,
      ads_used_today: user.reward_ads_used_today,
      ads_left: 10 - user.reward_ads_used_today
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }

};
