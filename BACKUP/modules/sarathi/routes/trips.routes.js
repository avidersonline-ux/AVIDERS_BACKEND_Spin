const express = require("express");
const router = express.Router();
const { createTrip, getTrip } = require("../controllers/trips.controller");

router.post("/create", createTrip);
router.get("/:id", getTrip);

module.exports = router;
