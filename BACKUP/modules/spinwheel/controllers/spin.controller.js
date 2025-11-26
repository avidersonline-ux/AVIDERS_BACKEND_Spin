const SpinService = require("../services/spin.service");
const SpinUser = require("../models/spinUser.model");

// -------------------------------------------------------
// SPIN NOW
// -------------------------------------------------------
exports.spinNow = async (req, res) => {
  try {
    // Accept UID + email from Firebase OR request body OR query params
    const uid = req.user?.uid || req.body.uid || req.query.uid;
    const email = req.user?.email || req.body.email || req.query.email;

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: "UID is required"
      });
    }

    const result = await SpinService.processSpin(uid, email);

    if (result.error === "NO_SPINS_LEFT") {
      return res.status(400).json({
        success: false,
        message: "No spins left. Watch ads to earn bonus spins."
      });
    }

    let message = "";
    if (result.type === "coins") {
      message = `Congratulations! You won ${result.value} coins!`;
    } else if (result.type === "coupon") {
      message = `You won a coupon: ${result.code}`;
    } else {
      message = "Better luck next time!";
    }

    return res.json({
      success: true,
      reward: {
        type: result.type,
        value: result.value,
        code: result.code
      },
      free_spin_used_today: result.free_spin_used_today,
      bonus_spins_left: result.bonus_spins_left,
      message
    });

  } catch (err) {
    console.error("SPIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Spin failed"
    });
  }
};

// -------------------------------------------------------
// SPIN STATUS
// -------------------------------------------------------
exports.spinStatus = async (req, res) => {
  try {
    // Accept UID from Firebase OR browser URL OR request body
    const uid = req.user?.uid || req.query.uid || req.body.uid;
    const email = req.user?.email || req.query.email || req.body.email;

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: "UID is required"
      });
    }

    const status = await SpinService.getStatus(uid);

    return res.json({
      success: true,
      free_spin_available: status.freeSpinAvailable,
      bonus_spins: status.bonusSpins,
      wallet_coins: status.walletCoins
    });

  } catch (err) {
    console.error("STATUS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error (status)"
    });
  }
};

// -------------------------------------------------------
// ADD BONUS SPIN (Rewarded Ad)
// -------------------------------------------------------
exports.addBonusSpin = async (req, res) => {
  try {
    // Accept UID + email from Firebase OR request body OR query
    const uid = req.user?.uid || req.body.uid || req.query.uid;
    const email = req.user?.email || req.body.email || req.query.email;

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: "UID is required"
      });
    }

    let user = await SpinUser.findOne({ uid });

    if (!user) {
      // Create new user if not existing
      user = await SpinUser.create({
        uid,
        email,
        spin_balance: 1,
        free_spin_used_today: false,
        coins: 0
      });
    } else {
      // Add 1 bonus spin
      user.spin_balance += 1;
      await user.save();
    }

    return res.json({
      success: true,
      message: "Bonus spin added.",
      bonus_spins_left: user.spin_balance
    });

  } catch (err) {
    console.error("BONUS SPIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error (bonus spin)"
    });
  }
};
