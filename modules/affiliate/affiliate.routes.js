const express = require('express');
const router = express.Router();
const controller = require('./affiliate.controller');
const catchAsync = require('../../utils/catchAsync');
const { requireAdmin, verifyToken } = require('../../middleware/auth'); // Add verifyToken

// User Routes (protected by verifyToken)
router.post('/claim', 
  verifyToken,
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

// ✅ ADD SPEND ROUTE (for users to spend coins)
router.post('/spend/:uid', 
  verifyToken,
  catchAsync((req, res, next) => controller.spend(req, res, next))
);

// Admin Routes (protected by requireAdmin)
router.get('/admin/pending', 
  requireAdmin, 
  catchAsync((req, res, next) => controller.getPending(req, res, next))
);

router.post('/admin/approve/:claimId', 
  requireAdmin, 
  catchAsync((req, res, next) => controller.approve(req, res, next))
);

// ✅ ADD REJECT ROUTE (admin can reject claims)
router.post('/admin/reject/:claimId', 
  requireAdmin, 
  catchAsync((req, res, next) => controller.reject(req, res, next))
);

// ✅ CORRECTED: Admin maturity processing route
router.post('/admin/process-maturity', 
  requireAdmin, 
  catchAsync((req, res, next) => controller.processMaturityCron(req, res, next))
);

module.exports = router;
