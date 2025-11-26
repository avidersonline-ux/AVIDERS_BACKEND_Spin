// Global Error Handler Middleware

module.exports = (err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", err);

  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
