// modules/spinwheel-service/controllers/spin.controller.js

const SpinService = require("../services/spin.service");
const SpinUser = require("../models/spinUser.model");

// -------------------------------------------------------
// SPIN NOW
// -------------------------------------------------------
exports.spinNow = async (req, res) => {
  try {
    const uid = req.user?.uid || req.body.uid || req.query.uid;
    const email = req.user?.email || req.body.email || req.query.email;

    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    const result = await SpinService.spinNow(uid, email);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({
      success: true,
      reward: result.reward,
      sector: result.sector,
      free_spin_used_today: result.free_spin_used_today,
      bonus_spins_left: result.bonus_spins_left
    });

  } catch (err) {
    console.error("SPIN ERROR:", err);
    return res.status(500).json({ success: false, message: "Spin failed" });
  }
};

// -------------------------------------------------------
// SPIN STATUS
// -------------------------------------------------------
exports.spinStatus = async (req, res) => {
  try {
    const uid = req.user?.uid || req.query.uid || req.body.uid;

    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    const status = await SpinService.getStatus(uid);

    return res.json(status);

  } catch (err) {
    console.error("STATUS ERROR:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// -------------------------------------------------------
// ADD BONUS SPIN (Rewarded Ad)
// -------------------------------------------------------
exports.addBonusSpin = async (req, res) => {
  try {
    const uid = req.user?.uid || req.body.uid || req.query.uid;
    const email = req.user?.email || req.body.email || req.query.email;

    if (!uid) {
      return res.status(400).json({ success: false, message: "UID is required" });
    }

    let user = await SpinUser.findOne({ uid });

    if (!user) {
      user = await SpinUser.create({
        uid,
        email,
        spin_balance: 1,
        free_spin_used_today: false,
        coins: 0
      });
    } else {
      user.spin_balance += 1;
      await user.save();
    }

    return res.json({
      success: true,
      message: "Bonus spin added",
      bonus_spins_left: user.spin_balance
    });

  } catch (err) {
    console.error("BONUS SPIN ERROR:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

