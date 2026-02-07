const claimsService = require('./claims.service');
const { sendSuccess } = require('../../utils/responseHandler');
const { AppError } = require('../../utils/errorHandler');

class ClaimsController {
  async submitClaim(req, res, next) {
    const { uid, orderId, productName, amount, source, expectedReward } = req.body;
    const file = req.file;

    if (!uid || !orderId || !amount || !file) {
      return next(new AppError('Required fields (uid, orderId, amount, screenshot) are missing', 400));
    }

    const claimData = {
      uid,
      orderId,
      productName: productName || 'Product',
      orderAmount: parseFloat(amount),
      source: source || 'Unknown',
      expectedReward: expectedReward ? parseFloat(expectedReward) : 0
    };

    const claim = await claimsService.createClaim(claimData, file);
    sendSuccess(res, claim, 'Claim submitted successfully', 201);
  }

  async approve(req, res, next) {
    const { id } = req.params;
    const { adminNote } = req.body;
    const adminId = req.user?.uid || 'admin';

    if (!id) return next(new AppError('Claim ID is required', 400));

    const claim = await claimsService.approveClaim(id, adminId, adminNote);
    sendSuccess(res, claim, 'Claim approved and coins credited');
  }

  async reject(req, res, next) {
    const { id } = req.params;
    const { adminNote } = req.body;
    const adminId = req.user?.uid || 'admin';

    if (!id) return next(new AppError('Claim ID is required', 400));

    const claim = await claimsService.rejectClaim(id, adminId, adminNote);
    sendSuccess(res, claim, 'Claim rejected');
  }

  async getMyClaims(req, res, next) {
    const { uid } = req.params;
    const claims = await claimsService.getUserClaims(uid);
    sendSuccess(res, claims);
  }

  async getPendingClaims(req, res, next) {
    const claims = await claimsService.getPendingClaims();
    sendSuccess(res, claims);
  }
}

module.exports = new ClaimsController();
