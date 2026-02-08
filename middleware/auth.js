const firebaseConfig = require('../config/firebase');
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
    if (!firebaseConfig.isInitialized) {
      if (process.env.NODE_ENV !== 'production') {
        req.user = { uid: req.body.uid || 'dev_user' };
        return next();
      }
      return next(new AppError('Authentication service unavailable', 503));
    }

    const decodedToken = await firebaseConfig.admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('❌ Token Verification Error:', error.message);
    return next(new AppError('Invalid or expired token', 401));
  }
};

/**
 * Admin Key check - Supports both old and new secret names
 */
const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];

  // ✅ Check for your new variable ADMIN_SECRET_1 first, then fallback
  const expectedSecret = process.env.ADMIN_SECRET_1 || process.env.ADMIN_SECRET;

  if (!adminKey) {
    console.log('⚠️ Admin Access Denied: No x-admin-key header provided');
    return next(new AppError('Admin access denied', 403));
  }

  if (adminKey !== expectedSecret) {
    console.log(`🚫 Admin Access Denied: Incorrect key provided. Expected matching value of ADMIN_SECRET_1`);
    return next(new AppError('Admin access denied', 403));
  }

  next();
};

module.exports = {
  verifyToken,
  requireAdmin
};
