const express = require('express');
const router = express.Router();
const claimsController = require('./claims.controller');
const upload = require('../../middleware/upload');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const catchAsync = require('../../utils/catchAsync');

// User Routes
// POST /api/claims/submit - Flutter app sends claim with screenshot
router.post('/submit', verifyToken, upload.single('screenshot'), catchAsync((req, res, next) => claimsController.submitClaim(req, res, next)));

// GET /api/claims/my-claims/:uid
router.get('/my-claims/:uid', verifyToken, catchAsync((req, res, next) => claimsController.getMyClaims(req, res, next)));

// Admin Routes
router.get('/pending', requireAdmin, catchAsync((req, res, next) => claimsController.getPendingClaims(req, res, next)));
router.post('/approve/:id', requireAdmin, catchAsync((req, res, next) => claimsController.approve(req, res, next)));
router.post('/reject/:id', requireAdmin, catchAsync((req, res, next) => claimsController.reject(req, res, next)));

module.exports = router;
