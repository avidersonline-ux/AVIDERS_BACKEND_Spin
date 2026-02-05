const express = require('express');
const router = express.Router();
const walletController = require('./wallet.controller');
const catchAsync = require('../../utils/catchAsync');

// All wallet routes
router.post('/balance', catchAsync(walletController.getBalance));
router.post('/history', catchAsync(walletController.getHistory));
router.post('/spend', catchAsync(walletController.spend));

// Admin routes
router.post('/admin/credit', catchAsync(walletController.adminCredit));

module.exports = router;

