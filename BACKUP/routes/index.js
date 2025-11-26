const router = require("express").Router();

router.use("/user", require("./user.routes"));
router.use(
  "/spinwheel",
  require("../modules/spinwheel/routes/spin.routes")  // ✔ correct path
);

module.exports = router;
