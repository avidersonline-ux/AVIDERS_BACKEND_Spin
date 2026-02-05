/**
 * Custom Error class for operational errors that are safe to expose to the client.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware.
 * Catches all errors and sends a structured JSON response.
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log all errors for internal monitoring
  if (err.statusCode === 500) {
    console.error('🔥 SERVER ERROR:', err);
  } else {
    console.warn(`⚠️ ${err.statusCode} - ${err.message}`);
  }

  const response = {
    success: false,
    status: err.status,
    message: err.message,
  };

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.error = err;
  }

  // In production, mask non-operational errors
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    response.message = 'Something went wrong on our end. Please try again later.';
  }

  res.status(err.statusCode).json(response);
};

module.exports = {
  AppError,
  globalErrorHandler,
};

