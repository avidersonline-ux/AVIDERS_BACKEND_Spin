// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/** Generate JWT */
function createJwt(user) {
  return jwt.sign(
    {
      id: user._id,
      firebaseUid: user.firebaseUid || null,
      email: user.email,
      name: user.name,
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/** Clean user before returning */
function sanitize(user) {
  const obj = user.toObject();
  delete obj.passwordHash;
  return obj;
}

/* ------------------------------------------------------
   POST /auth/register  (Email + Password)
------------------------------------------------------ */
router.post("/register", async (req, res) => {
  try {
    const { email, password, name, firstName, lastName, phone } = req.body;

    if (!email || !password)
      return res.status(400).json({ ok: false, error: "Email and password are required" });

    // 🔥 Check if already exists (email merge rule)
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ ok: false, error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: email.toLowerCase(),
      username: email.split("@")[0],
      passwordHash,
      name: name || `${firstName || ""} ${lastName || ""}`.trim(),
      firstName: firstName || "",
      lastName: lastName || "",
      phone: phone || "",
      provider: "email",
      verified: false
    });

    const token = createJwt(user);

    res.status(201).json({ ok: true, token, user: sanitize(user) });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/* ------------------------------------------------------
   POST /auth/login  (Email + Password)
------------------------------------------------------ */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ ok: false, error: "Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const token = createJwt(user);
    res.json({ ok: true, token, user: sanitize(user) });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/* ------------------------------------------------------
   POST /auth/google
   (EMAIL MERGE + WORKS WITH EXISTING USERS)
------------------------------------------------------ */
router.post("/google", async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email)
      return res.status(400).json({ ok: false, error: "Google email missing" });

    // 🔥 Merge by email
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        email: email.toLowerCase(),
        username: email.split("@")[0],
        name: name || email.split("@")[0],
        provider: "google",
        verified: true,
        passwordHash: await bcrypt.hash(Math.random().toString(36), 10)
      });
    }

    const token = createJwt(user);
    res.json({ ok: true, token, user: sanitize(user) });

  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/* ------------------------------------------------------
   POST /auth/firebase-login
   MERGE RULE:
   1. Match by firebaseUid
   2. Else match by email (merge accounts)
   3. Else create new user
------------------------------------------------------ */
router.post("/firebase-login", async (req, res) => {
  try {
    const { firebaseUid, email, name, phone } = req.body;

    if (!firebaseUid || !email)
      return res.status(400).json({ ok: false, error: "Missing Firebase UID or email" });

    let user = null;

    // Step 1 → Find by UID
    user = await User.findOne({ firebaseUid });

    // Step 2 → If not found, merge by email
    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // MERGE Firebase UID into existing Email user
        user.firebaseUid = firebaseUid;
        await user.save();
      }
    }

    // Step 3 → Create new if none exists
    if (!user) {
      user = await User.create({
        firebaseUid,
        email: email.toLowerCase(),
        username: email.split("@")[0],
        name: name || email.split("@")[0],
        phone: phone || "",
        provider: "firebase",
        verified: true
      });
    }

    const token = createJwt(user);

    res.json({ ok: true, token, user: sanitize(user) });

  } catch (err) {
    console.error("Firebase Login Error:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/* ------------------------------------------------------
   POST /auth/refresh
------------------------------------------------------ */
router.post("/refresh", (req, res) => {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token)
      return res.status(401).json({ ok: false, error: "Token required" });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err)
        return res.status(403).json({ ok: false, error: "Invalid token" });

      const newToken = createJwt(decoded);
      res.json({ ok: true, token: newToken });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Internal error" });
  }
});

module.exports = router;
