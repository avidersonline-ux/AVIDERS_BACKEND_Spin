const express = require('express');
const router = express.Router();
const controller = require('./affiliate.controller');
const catchAsync = require('../../utils/catchAsync');
const { requireAdmin, verifyToken } = require('../../middleware/auth');
const upload = require('../../middleware/upload.middleware'); // Add this

// User Routes (protected by verifyToken)
router.post('/claim', 
  verifyToken,
  upload.single('screenshot'), // Add this middleware for file upload
  catchAsync((req, res, next) => controller.submitClaim(req, res, next))
);

router.get('/claims/:uid', 
  verifyToken,
  catchAsync((req, res, next) => controller.getMyClaims(req, res, next))
);

router.get('/wallet/summary/:uid', 
  verifyToken,
  catchAsync((req, res, next) => controller.getWalletSummary(req, res, next))
);

router.post('/spend/:uid', 
  verifyToken,
  catchAsync((req, res, next) => controller.spend(req, res, next))
);

// Admin Routes
router.get('/admin/pending', 
  requireAdmin, 
  catchAsync((req, res, next) => controller.getPending(req, res, next))
);

router.post('/admin/approve/:claimId', 
  requireAdmin, 
  catchAsync((req, res, next) => controller.approve(req, res, next))
);

router.post('/admin/reject/:claimId', 
  requireAdmin, 
  catchAsync((req, res, next) => controller.reject(req, res, next))
);

router.post('/admin/process-maturity', 
  requireAdmin, 
  catchAsync((req, res, next) => controller.processMaturityCron(req, res, next))
);

module.exports = router;
