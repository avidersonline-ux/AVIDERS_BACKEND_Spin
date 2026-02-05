/**
 * Standardized Response Handler for AVIDERS Backend
 * Ensures consistent JSON structure for the Flutter mobile app.
 */

/**
 * Send a success response
 * @param {Object} res - Express response object
 * @param {Object} data - Data to send to the client
 * @param {String} message - Success message
 * @param {Number} statusCode - HTTP status code (default 200)
 */
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Send a 201 Created success response
 */
const sendCreated = (res, data, message = 'Created successfully') => {
  sendSuccess(res, data, message, 201);
};

/**
 * Send a paginated success response
 */
const sendPaginated = (res, data, total, page, limit, message = 'Success') => {
  res.status(200).json({
    success: true,
    message,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    },
    data
  });
};

module.exports = {
  sendSuccess,
  sendCreated,
  sendPaginated
};

