const router = require("express").Router();
const controller = require("../controllers/spin.controller");

// GET spin status
router.get("/status", controller.getStatus);

// Perform a spin
router.post("/spin", controller.spinNow);

// Bonus spin from ads
router.post("/bonus", controller.addBonusSpin);

// (Optional) History
router.get("/history", controller.getHistory);

// (Optional) Rewards list
router.get("/rewards", controller.getRewards);

module.exports = router;
