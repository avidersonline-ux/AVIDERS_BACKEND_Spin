const express = require('express');
const router = express.Router();
const controller = require('./affiliate.controller');
const catchAsync = require('../../utils/catchAsync');
const { requireAdmin } = require('../../middleware/auth');

// User Routes
router.post('/claim', catchAsync((req, res, next) => controller.submitClaim(req, res, next)));
router.get('/claims/:uid', catchAsync((req, res, next) => controller.getMyClaims(req, res, next)));
router.get('/wallet/summary/:uid', catchAsync((req, res, next) => controller.getWalletSummary(req, res, next)));

// Admin Routes
router.get('/admin/pending', requireAdmin, catchAsync((req, res, next) => controller.getPending(req, res, next)));
router.post('/admin/approve/:claimId', requireAdmin, catchAsync((req, res, next) => controller.approve(req, res, next)));

module.exports = router;
