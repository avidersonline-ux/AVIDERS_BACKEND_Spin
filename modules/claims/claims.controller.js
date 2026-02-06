const claimsService = require('./claims.service');
const { sendSuccess } = require('../../utils/responseHandler');
const { AppError } = require('../../utils/errorHandler');

class ClaimsController {
  async uploadClaim(req, res, next) {
    const { uid, orderId, orderAmount } = req.body;
    const file = req.file;

    if (!uid || !orderId || !orderAmount || !file) {
      return next(new AppError('All fields including screenshot are required', 400));
    }

    const claim = await claimsService.createClaim(uid, orderId, parseFloat(orderAmount), file);
    sendSuccess(res, claim, 'Claim submitted successfully', 201);
  }

  async approve(req, res, next) {
    const { claimId, adminNote } = req.body;
    const adminId = req.user.uid; // From verifyToken middleware

    if (!claimId) return next(new AppError('Claim ID is required', 400));

    const claim = await claimsService.approveClaim(claimId, adminId, adminNote);
    sendSuccess(res, claim, 'Claim approved and coins locked for 60 days');
  }

  async reject(req, res, next) {
    const { claimId, adminNote } = req.body;
    const adminId = req.user.uid;

    if (!claimId) return next(new AppError('Claim ID is required', 400));

    const claim = await claimsService.rejectClaim(claimId, adminId, adminNote);
    sendSuccess(res, claim, 'Claim rejected');
  }

  async getMyClaims(req, res, next) {
    const { uid } = req.params;
    const claims = await claimsService.getUserClaims(uid);
    sendSuccess(res, claims);
  }
}

module.exports = new ClaimsController();
