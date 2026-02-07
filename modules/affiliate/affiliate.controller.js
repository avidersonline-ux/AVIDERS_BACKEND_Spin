const affiliateService = require('./affiliate.service');
const { validateClaim } = require('./affiliate.validation');
const { sendSuccess } = require('../../utils/responseHandler');
const { AppError } = require('../../utils/errorHandler');
const walletService = require('../wallet/wallet.service');
const AffiliateClaim = require('../../models/AffiliateClaim');
const Wallet = require('../../models/Wallet');

class AffiliateController {
  async submitClaim(req, res, next) {
    const { error } = validateClaim(req.body);
    if (error) return next(new AppError(error.details[0].message, 400));

    const claim = await affiliateService.submitClaim(req.body);
    sendSuccess(res, claim, 'Claim submitted successfully', 201);
  }

  async getMyClaims(req, res, next) {
    const { uid } = req.params;
    const claims = await AffiliateClaim.find({ userId: uid }).sort({ createdAt: -1 });
    sendSuccess(res, claims);
  }

  async getWalletSummary(req, res, next) {
    const { uid } = req.params;
    const wallet = await Wallet.findOne({ userId: uid });
    const pendingClaims = await AffiliateClaim.countDocuments({ userId: uid, status: 'pending' });

    // Spendable Logic: 60% Cap
    const totalMatured = wallet ? wallet.unlockedBalance : 0;
    const spendLimit = Math.floor(totalMatured * 0.60);
    const currentSpent = wallet ? wallet.totalSpent || 0 : 0;
    const availableToSpend = Math.max(0, spendLimit - currentSpent);

    sendSuccess(res, {
      totalCoins: (wallet ? wallet.unlockedBalance + wallet.lockedBalance : 0),
      lockedCoins: (wallet ? wallet.lockedBalance : 0),
      maturedCoins: totalMatured,
      spendableLimit: spendLimit,
      currentSpent: currentSpent,
      availableToSpend: availableToSpend,
      pendingClaims
    });
  }

  async spend(req, res, next) {
    const { uid } = req.params;
    const { amount, description } = req.body;
    
    if (!amount || amount <= 0) {
      return next(new AppError('Valid amount is required', 400));
    }
    
    // Get wallet to check spend limit
    const wallet = await Wallet.findOne({ userId: uid });
    if (!wallet) {
      return next(new AppError('Wallet not found', 404));
    }
    
    // Check 60% spend limit
    const spendableLimit = Math.floor(wallet.unlockedBalance * 0.60);
    const currentSpent = wallet.totalSpent || 0;
    
    if (currentSpent + amount > spendableLimit) {
      return next(new AppError(`Exceeds 60% spend limit. Available: ${spendableLimit - currentSpent}`, 400));
    }
    
    // Process spending through wallet service
    const transaction = await walletService.debit(
      uid,
      amount,
      'SPEND',
      `spend_${Date.now()}`,
      { description }
    );
    
    sendSuccess(res, transaction, 'Spending processed successfully');
  }

  // Admin Actions
  async approve(req, res, next) {
    const { claimId } = req.params;
    const { adminNote } = req.body;
    const claim = await affiliateService.approveClaim(claimId, adminNote);
    sendSuccess(res, claim, 'Claim approved and coins locked');
  }

  // ✅ ADD THIS REJECT METHOD
  async reject(req, res, next) {
    const { claimId } = req.params;
    const { adminNote } = req.body;
    const claim = await affiliateService.rejectClaim(claimId, adminNote);
    sendSuccess(res, claim, 'Claim rejected');
  }

  async getPending(req, res, next) {
    const claims = await AffiliateClaim.find({ status: 'pending' }).sort({ createdAt: 1 });
    sendSuccess(res, claims);
  }

  // Admin cron endpoint for maturity processing
  async processMaturityCron(req, res, next) {
    const processed = await affiliateService.processMaturity();
    sendSuccess(res, { processed }, `Matured ${processed} claims`);
  }
}

module.exports = new AffiliateController();
