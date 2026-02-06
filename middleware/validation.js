const Joi = require('joi');
const { AppError } = require('../utils/errorHandler');

/**
 * Higher-order function to validate request body against a Joi schema
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(errorMessage, 400));
    }
    next();
  };
};

module.exports = {
  validateRequest
};
