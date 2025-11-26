const express = require("express");
const router = express.Router();
const { getEstimate } = require("../controllers/pricing.controller");

router.post("/estimate", getEstimate);

module.exports = router;
