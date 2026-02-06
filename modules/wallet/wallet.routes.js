const express = require('express');
const router = express.Router();
const walletController = require('./wallet.controller');
const catchAsync = require('../../utils/catchAsync');

router.post('/balance', catchAsync((req, res, next) => walletController.getBalance(req, res, next)));
router.post('/history', catchAsync((req, res, next) => walletController.getHistory(req, res, next)));
router.post('/spend', catchAsync((req, res, next) => walletController.spend(req, res, next)));
router.post('/admin/credit', catchAsync((req, res, next) => walletController.adminCredit(req, res, next)));

module.exports = router;
