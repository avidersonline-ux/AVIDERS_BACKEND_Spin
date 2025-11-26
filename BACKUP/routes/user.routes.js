const router = require("express").Router();
const { db } = require("../core/firebase");
const firebaseAuth = require("../middleware/firebaseAuth");

// GET profile
router.get("/profile", firebaseAuth, async (req, res) => {
  const doc = await db.collection("users").doc(req.user.uid).get();

  if (!doc.exists) {
    await db.collection("users").doc(req.user.uid).set({
      ...req.user,
      createdAt: new Date(),
    });
  }

  const profile = await db.collection("users").doc(req.user.uid).get();
  res.json({ success: true, user: profile.data() });
});

// UPDATE profile
router.post("/profile", firebaseAuth, async (req, res) => {
  await db.collection("users").doc(req.user.uid).set(req.body, { merge: true });
  res.json({ success: true });
});

module.exports = router;
