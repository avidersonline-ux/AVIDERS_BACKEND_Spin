const affiliateService = require('./affiliate.service');
const { validateClaim } = require('./affiliate.validation');
const { sendSuccess } = require('../../utils/responseHandler');
const { AppError } = require('../../utils/errorHandler');
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

    sendSuccess(res, {
      totalCoins: (wallet ? wallet.unlockedBalance + wallet.lockedBalance : 0),
      lockedCoins: (wallet ? wallet.lockedBalance : 0),
      maturedCoins: totalMatured,
      spendableLimit: spendLimit,
      pendingClaims
    });
  }

  // Admin Actions
  async approve(req, res, next) {
    const { claimId } = req.params;
    const { adminNote } = req.body;
    const claim = await affiliateService.approveClaim(claimId, adminNote);
    sendSuccess(res, claim, 'Claim approved and coins locked');
  }

  async getPending(req, res, next) {
    const claims = await AffiliateClaim.find({ status: 'pending' }).sort({ createdAt: 1 });
    sendSuccess(res, claims);
  }
}

module.exports = new AffiliateController();
