const router = require("express").Router();

// Only SpinWheel route
router.use("/spinwheel", require("../modules/spinwheel/routes/spin.routes"));

module.exports = router;

