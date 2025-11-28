const router = require("express").Router();

router.use("/spin", require("./spin.routes"));

module.exports = router;
