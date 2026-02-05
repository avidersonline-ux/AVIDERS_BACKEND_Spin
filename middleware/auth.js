const { admin, isInitialized } = require('../config/firebase');
const { AppError } = require('../utils/errorHandler');

/**
 * Verifies Firebase ID Token
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('No token provided. Please login.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    if (!isInitialized) {
      // Fallback for dev environment if Firebase is disabled
      if (process.env.NODE_ENV !== 'production') {
        req.user = { uid: req.body.uid || 'dev_user' };
        return next();
      }
      return next(new AppError('Authentication service unavailable', 503));
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return next(new AppError('Invalid or expired token', 401));
  }
};

/**
 * Simple Admin Key check (matches existing server.js logic)
 */
const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
    return next(new AppError('Admin access denied', 403));
  }
  next();
};

module.exports = {
  verifyToken,
  requireAdmin
};

