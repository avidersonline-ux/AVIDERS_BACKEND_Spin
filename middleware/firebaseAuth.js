const { admin } = require("../core/firebase");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const idToken = authHeader.split(" ")[1];

    // Verify Firebase ID Token
    const decoded = await admin.auth().verifyIdToken(idToken);

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
    };

    next();
  } catch (error) {
    console.error("🔥 FIREBASE AUTH ERROR:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
