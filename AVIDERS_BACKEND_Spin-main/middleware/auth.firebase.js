const admin = require("firebase-admin");

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  const serviceAccount = require("./firebaseAuth.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const authenticateFirebase = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No authorization token provided"
      });
    }

    const token = authHeader.split("Bearer ")[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format"
      });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    
    // Ensure UID matches
    if (req.body.uid && req.body.uid !== decodedToken.uid) {
      return res.status(403).json({
        success: false,
        message: "UID mismatch"
      });
    }

    next();
  } catch (error) {
    console.error("❌ Firebase auth error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      error: error.message
    });
  }
};

module.exports = authenticateFirebase;
