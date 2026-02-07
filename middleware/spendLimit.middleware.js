const Wallet = require('../../models/Wallet');
const { AppError } = require('../../utils/errorHandler');

const checkSpendLimit = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return next(new AppError('Valid amount is required', 400));
    }
    
    const wallet = await Wallet.findOne({ userId: uid });
    if (!wallet) {
      return next(new AppError('Wallet not found', 404));
    }
    
    // Calculate spendable limit (60% of unlocked balance)
    const spendableLimit = Math.floor(wallet.unlockedBalance * 0.60);
    const currentSpent = wallet.totalSpent || 0;
    
    if (currentSpent + amount > spendableLimit) {
      return next(new AppError(
        `Exceeds 60% spend limit. Maximum available: ${spendableLimit - currentSpent} coins`,
        400
      ));
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { checkSpendLimit };
