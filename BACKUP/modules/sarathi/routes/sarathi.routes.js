const router = require("express").Router();
const auth = require("../../middleware/auth");

const pricingCtrl = require("../controllers/pricing.controller");
const tripCtrl = require("../controllers/trips.controller");

// Estimate
router.post("/estimate", pricingCtrl.estimate);

// Book (requires login)
router.post("/book", auth, tripCtrl.book);

// Track
router.get("/trip/:id", tripCtrl.track);

module.exports = router;
