const express = require("express");
const router = express.Router();
const claimsController = require("./claims.controller");
const upload = require("../../middleware/upload.middleware");
const { verifyToken, requireAdmin } = require("../../middleware/auth");
const catchAsync = require("../../utils/catchAsync");

// Test Endpoint
router.get("/test", (req, res) => {
  res.json({ success: true, module: "claims working" });
});

// User Routes
// POST /api/claims/submit - Flutter app sends claim with screenshot
router.post(
  "/submit",
  verifyToken,
  upload.single("screenshot"),
  catchAsync((req, res, next) => claimsController.submitClaim(req, res, next))
);

// GET /api/claims/user/:userId - Get claims for a specific user
router.get(
  "/user/:userId",
  verifyToken,
  catchAsync((req, res, next) => claimsController.getUserClaims(req, res, next))
);

// Admin Routes
// GET /api/claims/admin/pending - Get all pending claims
router.get(
  "/admin/pending",
  requireAdmin,
  catchAsync((req, res, next) => claimsController.getPendingClaims(req, res, next))
);

module.exports = router;
