const walletService = require('../wallet/wallet.service');
const { SOURCES } = require('../wallet/transaction.types');

class ReferralService {
  /**
   * Credit referral bonuses to both referrer and new user
   */
  async creditReferralBonus(referrerUid, newUserUid, referralCode) {
    const referenceIdPrefix = `ref_${referralCode}_${newUserUid}`;

    // 1. Credit Referrer
    const referrerBonus = 100;
    await walletService.credit(
      referrerUid,
      referrerBonus,
      SOURCES.REFERRAL,
      `${referenceIdPrefix}_referrer`,
      { type: 'referrer_bonus', referredUser: newUserUid }
    );

    // 2. Credit New User
    const newUserBonus = 50;
    await walletService.credit(
      newUserUid,
      newUserBonus,
      SOURCES.REFERRAL,
      `${referenceIdPrefix}_newuser`,
      { type: 'welcome_bonus', referredBy: referrerUid }
    );

    return { referrerBonus, newUserBonus };
  }
}

module.exports = new ReferralService();

