const router = require("express").Router();
const auth = require("../../../middleware/firebaseAuth");

const {
  spinNow,
  spinStatus,
  addBonusSpin
} = require("../controllers/spin.controller");

// All spin wheel actions require Firebase login
router.get("/status", auth, spinStatus);
router.post("/spin", auth, spinNow);
router.post("/ad-spin", auth, addBonusSpin);

module.exports = router;
