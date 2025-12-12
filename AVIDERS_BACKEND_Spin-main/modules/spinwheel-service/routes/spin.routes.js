// modules/spinwheel-service/routes/spin.routes.js
const express = require("express");
const router = express.Router();

const SpinUser = require("../models/SpinUser");
const SpinHistory = require("../models/SpinHistory");
const spinCtrl = require("../controllers/spin.controller");
const spinService = require("../services/spin.service");

// Optional auth middleware (if you have it). We'll prefer req.user.uid when available.
let firebaseAuth;
try {
  firebaseAuth = require("../../../middleware/auth.firebase");
} catch (e) {
  firebaseAuth = null;
  console.warn("⚠️ auth.firebase middleware not found — routes will accept uid from body/header");
}

// ---------------------- UID helper ----------------------
// Accepts header x-user-id, body.uid, body.userId — keeps backward compatibility
function getUID(req) {
  return (
    (req.headers && (req.headers["x-user-id"] || req.headers["x-user-id".toLowerCase()])) ||
    req.body?.uid ||
    req.body?.userId ||
    null
  );
}

// Resolve authoritative uid: prefer firebase token uid if present
function resolveUid(req) {
  if (req.user && req.user.uid) return req.user.uid;
  return getUID(req);
}

// Compatibility helper: find user by uid or old userId field
async function findOrCreateUserByUid(uid) {
  let user = await SpinUser.findOne({ $or: [{ uid }, { userId: uid }] });
  if (!user) {
    // create document using new `uid` field
    user = new SpinUser({ uid, free_spin_available: true, last_free_spin_given: null, bonus_spins: 0 });
    await user.save();
    console.log(`👤 Created SpinUser for uid: ${uid}`);
  } else if (!user.uid && user.userId) {
    // normalize old doc to new `uid` field
    user.uid = user.userId;
    await user.save();
    console.log(`🔁 Normalized userId -> uid for doc: ${uid}`);
  }
  return user;
}

// ---------------------- STATUS ----------------------
// This route accepts auth or header/body uid. It calls controller.getStatus for consistent behavior.
router.post("/status", firebaseAuth ? firebaseAuth : (req, res, next) => next(), async (req, res) => {
  try {
    const uid = resolveUid(req);
    console.log("🔎 STATUS UID RECEIVED →", uid, "BODY:", req.body || {});
    if (!uid) return res.status(400).json({ success: false, message: "UID is required" });

    // ensure req.body.uid so controller.getStatus can use it
    req.body = req.body || {};
    req.body.uid = uid;

    // Delegate to controller (which returns server-side authoritative status)
    return spinCtrl.getStatus(req, res);
  } catch (err) {
    console.error("❌ /status error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

// ---------------------- BONUS SPIN ----------------------
// Keep a simple bonus endpoint that increments server-side bonus_spins.
// Uses uid resolution and normalizes to new schema.
router.post("/bonus", firebaseAuth ? firebaseAuth : (req, res, next) => next(), async (req, res) => {
  try {
    const uid = resolveUid(req);
    console.log("➕ BONUS UID RECEIVED →", uid);
    if (!uid) return res.status(400).json({ success: false, message: "UID is required" });

    const user = await findOrCreateUserByUid(uid);
    user.bonus_spins = (user.bonus_spins || 0) + 1;
    await user.save();

    return res.json({ success: true, bonus_spins_left: user.bonus_spins });
  } catch (err) {
    console.error("❌ /bonus error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

// ---------------------- SPIN NOW ----------------------
// Delegate to controller.performSpin (transactional).
router.post("/spin", firebaseAuth ? firebaseAuth : (req, res, next) => next(), async (req, res) => {
  try {
    const uid = resolveUid(req);
    console.log("🎯 SPIN UID RECEIVED →", uid);
    if (!uid) return res.status(400).json({ success: false, message: "UID is required" });

    // set the body uid so controller/service can read it
    req.body = req.body || {};
    req.body.uid = uid;
    // allow spinType override (e.g. "bonus")
    // req.body.spinType may be present from client

    return spinCtrl.performSpin(req, res);
  } catch (err) {
    console.error("❌ /spin error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

// ---------------------- LEDGER ----------------------
// Return wallet + recent history (controller handles auth/body uid)
router.post("/ledger", firebaseAuth ? firebaseAuth : (req, res, next) => next(), async (req, res) => {
  try {
    const uid = resolveUid(req);
    if (!uid) return res.status(400).json({ success: false, message: "UID is required" });
    req.body = req.body || {};
    req.body.uid = uid;
    return spinCtrl.getLedger(req, res);
  } catch (err) {
    console.error("❌ /ledger error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

// ---------------------- REGISTER TOKEN (FCM) ----------------------
// Save device FCM token for push notifications
router.post("/register-token", firebaseAuth ? firebaseAuth : (req, res, next) => next(), async (req, res) => {
  try {
    const uid = resolveUid(req);
    const token = req.body?.token;
    if (!uid || !token) return res.status(400).json({ success: false, message: "uid and token required" });

    req.body = req.body || {};
    req.body.uid = uid;
    req.body.token = token;

    return spinCtrl.registerToken(req, res);
  } catch (err) {
    console.error("❌ /register-token error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

// ---------------------- ADMIN / INTERNAL (reset & notify) ----------------------
// These two endpoints are protected by x-internal-key header in controller
router.post("/admin/reset-daily", async (req, res) => {
  return spinCtrl.adminResetDaily(req, res);
});
router.post("/admin/run-notify", async (req, res) => {
  return spinCtrl.runNotify(req, res);
});

module.exports = router;
