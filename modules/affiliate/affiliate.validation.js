const Joi = require('joi');

const claimSchema = Joi.object({
  uid: Joi.string().required(),
  orderId: Joi.string().min(1).max(50).required(), // ✅ Reduced min length to 1
  productName: Joi.string().min(1).max(100).required(),
  orderAmount: Joi.number().positive().required(),
  affiliateNetwork: Joi.string().required(),
  screenshotUrl: Joi.string().uri().optional().allow(''),
  orderDate: Joi.date().optional() // ✅ Added validation for orderDate
});

module.exports = {
  validateClaim: (data) => claimSchema.validate(data)
};
