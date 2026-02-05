const walletService = require('../wallet/wallet.service');
const { SOURCES } = require('../wallet/transaction.types');

class SubscriptionService {
  /**
   * Reward user for active subscription (e.g. daily loyalty coins)
   */
  async creditSubscriptionReward(userId, planId, rewardAmount) {
    const today = new Date().toISOString().split('T')[0];
    const referenceId = `sub_reward_${userId}_${planId}_${today}`;

    return await walletService.credit(
      userId,
      rewardAmount,
      SOURCES.SUBSCRIPTION,
      referenceId,
      { planId, rewardType: 'daily_loyalty' }
    );
  }

  /**
   * Deduct subscription fee from wallet
   */
  async deductSubscriptionFee(userId, planId, amount) {
    const referenceId = `sub_fee_${userId}_${planId}_${Date.now()}`;

    return await walletService.debit(
      userId,
      amount,
      SOURCES.SUBSCRIPTION,
      referenceId,
      { planId, action: 'payment' }
    );
  }
}

module.exports = new SubscriptionService();

