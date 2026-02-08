const firebaseConfig = require('../config/firebase'); // ✅ Import the whole object
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
    // ✅ Check property on the config object to get latest state
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
 * Simple Admin Key check
 */
const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];

  // ✅ Logs for your Render dashboard to help you debug
  if (!adminKey) console.log('⚠️ Admin Request: No x-admin-key header');

  if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
    console.log(`🚫 Admin Access Denied: Provided key does not match ADMIN_SECRET`);
    return next(new AppError('Admin access denied', 403));
  }
  next();
};

module.exports = {
  verifyToken,
  requireAdmin
};
