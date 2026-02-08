/**
 * Transaction Type Constants and Enums
 * This file should NOT define the Mongoose model to avoid OverwriteModelError.
 */

module.exports = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',

  SOURCES: {
    SPIN: 'SPIN',
    REFERRAL: 'REFERRAL',
    CASHBACK: 'CASHBACK',
    SUBSCRIPTION: 'SUBSCRIPTION',
    MANUAL: 'MANUAL',
    SPEND: 'SPEND',
    AFFILIATE: 'AFFILIATE',
    AFFILIATE_MATURED: 'AFFILIATE_MATURED'
  },

  WALLET_STATUS: {
    ACTIVE: 'active',
    FROZEN: 'frozen'
  }
};
