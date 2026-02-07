const express = require("express");
const router = express.Router();
const claimsController = require("./claims.controller");
const upload = require("../../middleware/upload.middleware");
const { verifyToken, requireAdmin } = require("../../middleware/auth");
const catchAsync = require("../../utils/catchAsync");

/**
 * @route   GET /api/claims/test
 * @desc    Test if claims module is mounted correctly
 */
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Claims module is active" });
});

/**
 * @route   POST /api/claims/submit
 * @desc    Submit a new shopping claim with screenshot
 */
router.post(
  "/submit",
  verifyToken,
  upload.single("screenshot"),
  catchAsync((req, res, next) => claimsController.submitClaim(req, res, next))
);

/**
 * @route   GET /api/claims/my-claims/:uid
 * @desc    Get all claims for a specific user
 */
router.get(
  "/my-claims/:uid",
  verifyToken,
  catchAsync((req, res, next) => claimsController.getMyClaims(req, res, next))
);

/**
 * @route   GET /api/claims/admin/pending
 * @desc    Admin: Get all pending claims
 */
router.get(
  "/admin/pending",
  requireAdmin,
  catchAsync((req, res, next) => claimsController.getPendingClaims(req, res, next))
);

/**
 * @route   POST /api/claims/admin/approve/:id
 * @desc    Admin: Approve a claim and credit coins
 */
router.post(
  "/admin/approve/:id",
  requireAdmin,
  catchAsync((req, res, next) => claimsController.approve(req, res, next))
);

/**
 * @route   POST /api/claims/admin/reject/:id
 * @desc    Admin: Reject a claim
 */
router.post(
  "/admin/reject/:id",
  requireAdmin,
  catchAsync((req, res, next) => claimsController.reject(req, res, next))
);

module.exports = router;
