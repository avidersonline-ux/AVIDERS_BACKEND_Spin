const express = require('express');
const router = express.Router();
const claimsController = require('./claims.controller');
const upload = require('../../middleware/upload');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const catchAsync = require('../../utils/catchAsync');

// User Routes
// POST /api/claims/upload
router.post('/upload', verifyToken, upload.single('screenshot'), catchAsync((req, res, next) => claimsController.uploadClaim(req, res, next)));

// GET /api/claims/user/:uid
router.get('/user/:uid', verifyToken, catchAsync((req, res, next) => claimsController.getMyClaims(req, res, next)));

// Admin Routes
router.post('/approve', verifyToken, requireAdmin, catchAsync((req, res, next) => claimsController.approve(req, res, next)));
router.post('/reject', verifyToken, requireAdmin, catchAsync((req, res, next) => claimsController.reject(req, res, next)));

module.exports = router;
