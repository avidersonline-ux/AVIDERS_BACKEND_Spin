const express = require('express');
const router = express.Router();
const controller = require('./affiliate.controller');
const catchAsync = require('../../utils/catchAsync');
const { requireAdmin } = require('../../middleware/auth');

// User Routes
router.post('/claim', catchAsync(controller.submitClaim));
router.get('/claims/:uid', catchAsync(controller.getMyClaims));
router.get('/wallet/summary/:uid', catchAsync(controller.getWalletSummary));

// Admin Routes
router.get('/admin/pending', requireAdmin, catchAsync(controller.getPending));
router.post('/admin/approve/:claimId', requireAdmin, catchAsync(controller.approve));

module.exports = router;
