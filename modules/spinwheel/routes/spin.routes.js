const router = require("express").Router();
const controller = require("../controllers/spin.controller");
const adsController = require("../controllers/ads.controller");

// Get current spin status (free spin, bonus spins, coins, etc.)
router.get("/status", controller.spinStatus);

// Spin the wheel
router.post("/spin", controller.spinNow);

// Watch an ad → earn 1 extra spin (max 10/day)
router.post("/watch-ad", adsController.watchAd);

module.exports = router;
