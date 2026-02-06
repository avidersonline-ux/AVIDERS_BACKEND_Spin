const express = require('express');
const router = express.Router();
const claimsController = require('./claims.controller');
const upload = require('../../middleware/upload');
const { verifyToken } = require('../../middleware/auth');
const catchAsync = require('../../utils/catchAsync');

// User Routes
router.post('/upload', verifyToken, upload.single('screenshot'), catchAsync(claimsController.uploadClaim));
router.get('/user/:uid', verifyToken, catchAsync(claimsController.getMyClaims));

// Admin Routes
router.post('/approve', verifyToken, catchAsync(claimsController.approve));
router.post('/reject', verifyToken, catchAsync(claimsController.reject));

module.exports = router;
