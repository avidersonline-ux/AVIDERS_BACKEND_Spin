// modules/spinwheel-service/controllers/spin.controller.js
const mongoose = require('mongoose');
const SpinUser = require("../models/SpinUser");
const SpinHistory = require("../models/SpinHistory");
const Wallet = require("../models/wallet.model");
const spinService = require("../services/spin.service");
const admin = require('firebase-admin'); // ensure firebase-admin init in server.js or similar

const isDbConnected = () => mongoose.connection.readyState === 1;

const spinController = {
  async getStatus(req, res) {
    try {
      const uid = (req.user && req.user.uid) || req.body.uid;
      if (!uid) return res.status(400).json({ success:false, message:'uid required' });
      const status = await spinService.getStatus(uid);
      return res.json({ success:true, ...status });
    } catch (err) {
      return res.status(500).json({ success:false, message: err.message });
    }
  },

  async performSpin(req, res) {
    try {
      const uid = (req.user && req.user.uid) || req.body.uid;
      const spinType = req.body.spinType || 'free';
      if (!uid) return res.status(400).json({ success:false, message:'uid required' });

      const result = await spinService.performSpin(uid, spinType);
      return res.json({ success:true, reward: result.reward });
    } catch (err) {
      return res.status(400).json({ success:false, message: err.message || 'Spin error' });
    }
  },

  // ledger: wallet + recent history
  async getLedger(req, res) {
    try {
      const uid = (req.user && req.user.uid) || req.body.uid;
      if (!uid) return res.status(400).json({ success:false, message:'uid required' });
      const wallet = await Wallet.findOne({ uid }) || { coins: 0 };
      const history = await SpinHistory.find({ uid }).sort({ timestamp: -1 }).limit(100);
      return res.json({ success:true, wallet_coins: wallet.coins, history });
    } catch (err) {
      return res.status(500).json({ success:false, message: err.message });
    }
  },

  // Admin-only reset endpoint (protect with x-internal-key or admin auth)
  async adminResetDaily(req, res) {
    try {
      // simple internal key check
      const key = req.headers['x-internal-key'];
      if (!key || key !== process.env.SPIN_INTERNAL_KEY) {
        return res.status(401).json({ success:false, message:'Unauthorized' });
      }
      const result = await spinService.runDailyReset();
      return res.json({ success:true, result });
    } catch (err) {
      return res.status(500).json({ success:false, message: err.message });
    }
  },

  async registerToken(req, res) {
    try {
      const uid = (req.user && req.user.uid) || req.body.uid;
      const token = req.body.token;
      if (!uid || !token) return res.status(400).json({ success:false, message:'uid and token required' });
      await spinService.registerFcmToken(uid, token);
      return res.json({ success:true });
    } catch (err) {
      return res.status(500).json({ success:false, message: err.message });
    }
  },

  // Run notification (protected by internal key)
  async runNotify(req, res) {
    try {
      const key = req.headers['x-internal-key'];
      if (!key || key !== process.env.SPIN_INTERNAL_KEY) {
        return res.status(401).json({ success:false, message:'Unauthorized' });
      }

      // Ensure firebase-admin is initialized in server.js
      if (!admin.apps.length) {
        return res.status(500).json({ success:false, message:'Firebase admin not initialized' });
      }

      const users = await spinService.getUsersToNotify();
      let sent = 0;
      for (const u of users) {
        if (!u.fcm_tokens || u.fcm_tokens.length === 0) continue;
        const payload = {
          notification: { title: 'Your free spin is ready!', body: 'Tap to open Aviders and spin the wheel.' },
          data: { screen: 'spin' }
        };
        try {
          const resp = await admin.messaging().sendToDevice(u.fcm_tokens, payload);
          sent++;
        } catch (e) {
          console.warn('fcm send failed', e.message || e);
        }
      }
      return res.json({ success:true, notified: sent });
    } catch (err) {
      return res.status(500).json({ success:false, message: err.message });
    }
  }
};

module.exports = spinController;
