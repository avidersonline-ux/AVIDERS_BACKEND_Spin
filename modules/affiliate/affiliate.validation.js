const Joi = require('joi');

const claimSchema = Joi.object({
  uid: Joi.string().required(),
  orderId: Joi.string().min(5).max(50).required(),
  productName: Joi.string().min(2).max(100).required(),
  orderAmount: Joi.number().positive().required(),
  affiliateNetwork: Joi.string().required(),
  screenshotUrl: Joi.string().uri().required(),
  maturityDays: Joi.number().integer().min(1).max(365) // Optional override
});

module.exports = {
  validateClaim: (data) => claimSchema.validate(data)
};

