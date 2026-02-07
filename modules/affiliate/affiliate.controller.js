const affiliateService = require('./affiliate.service');
const { validateClaim } = require('./affiliate.validation');
const { sendSuccess } = require('../../utils/responseHandler');
const { AppError } = require('../../utils/errorHandler');
const walletService = require('../wallet/wallet.service');
const AffiliateClaim = require('../../models/AffiliateClaim');
const Wallet = require('../../models/Wallet');
const { uploadToR2 } = require('../../config/r2'); // Add this import

class AffiliateController {
  async submitClaim(req, res, next) {
    try {
      const { error } = validateClaim(req.body);
      if (error) return next(new AppError(error.details[0].message, 400));

      // ✅ Handle file upload if present (for Flutter multipart requests)
      if (req.file) {
        const file = req.file;
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `affiliate/pending/${req.body.uid}_${req.body.orderId}_${Date.now()}.${fileExtension}`;
        
        try {
          const screenshotUrl = await uploadToR2(file.buffer, fileName, file.mimetype);
          req.body.screenshotUrl = screenshotUrl;
        } catch (uploadError) {
          return next(new AppError('Failed to upload screenshot to storage', 500));
        }
      }

      // ✅ Check if screenshotUrl exists (either from upload or provided)
      if (!req.body.screenshotUrl) {
        return next(new AppError('Screenshot is required (either upload file or provide URL)', 400));
      }

      const claim = await affiliateService.submitClaim(req.body);
      sendSuccess(res, claim, 'Claim submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getMyClaims(req, res, next) {
    try {
      const { uid } = req.params;
      const claims = await AffiliateClaim.find({ userId: uid }).sort({ createdAt: -1 });
      sendSuccess(res, claims);
    } catch (error) {
      next(error);
    }
  }

  async getWalletSummary(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  async spend(req, res, next) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  // Admin Actions
  async approve(req, res, next) {
    try {
      const { claimId } = req.params;
      const { adminNote } = req.body;
      const claim = await affiliateService.approveClaim(claimId, adminNote);
      sendSuccess(res, claim, 'Claim approved and coins locked');
    } catch (error) {
      next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const { claimId } = req.params;
      const { adminNote } = req.body;
      const claim = await affiliateService.rejectClaim(claimId, adminNote);
      sendSuccess(res, claim, 'Claim rejected');
    } catch (error) {
      next(error);
    }
  }

  async getPending(req, res, next) {
    try {
      const claims = await AffiliateClaim.find({ status: 'pending' }).sort({ createdAt: 1 });
      sendSuccess(res, claims);
    } catch (error) {
      next(error);
    }
  }

  // Admin cron endpoint for maturity processing
  async processMaturityCron(req, res, next) {
    try {
      const processed = await affiliateService.processMaturity();
      sendSuccess(res, { processed }, `Matured ${processed} claims`);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AffiliateController();
