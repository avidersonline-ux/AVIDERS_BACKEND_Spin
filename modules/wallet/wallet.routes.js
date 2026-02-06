const express = require('express');
const router = express.Router();
const walletController = require('./wallet.controller');
const { requireAdmin, verifyToken } = require('../../middleware/auth');
const catchAsync = require('../../utils/catchAsync');

router.post('/balance', verifyToken, catchAsync((req, res, next) => walletController.getBalance(req, res, next)));
router.post('/history', verifyToken, catchAsync((req, res, next) => walletController.getHistory(req, res, next)));
router.post('/spend', verifyToken, catchAsync((req, res, next) => walletController.spend(req, res, next)));
router.post('/admin/credit', requireAdmin, catchAsync((req, res, next) => walletController.adminCredit(req, res, next)));

module.exports = router;
