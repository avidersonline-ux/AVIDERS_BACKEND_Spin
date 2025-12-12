// modules/spinwheel-service/services/spin.service.js
const mongoose = require('mongoose');
const SpinUser = require("../models/SpinUser");
const SpinHistory = require("../models/SpinHistory");
const Wallet = require("../models/wallet.model");
const rewardsConfig = require("../config/rewards.config.json");
const rewardEngine = require("../engine/rewardEngine");

// pickReward uses existing rewardEngine or simple fallback
function pickReward(rewards) {
  if (rewardEngine && rewardEngine.pick) return rewardEngine.pick(rewards);
  const total = rewards.reduce((sum, r) => sum + (r.probability || 0), 0);
  let random = Math.random() * total;
  for (let r of rewards) {
    if (random < (r.probability || 0)) return r;
    random -= (r.probability || 0);
  }
  return rewards[rewards.length - 1];
}

exports.getStatus = async (uid) => {
  let user = await SpinUser.findOne({ uid });
  if (!user) {
    user = await SpinUser.create({ uid, spin_balance: 1, free_spin_available: true, last_free_spin_given: new Date() });
  }
  const wallet = await Wallet.findOne({ uid }) || { coins: 0 };
  return {
    uid,
    free_spin_available: user.free_spin_available,
    bonus_spins: user.bonus_spins,
    wallet_coins: wallet.coins,
    last_free_spin_given: user.last_free_spin_given
  };
};

// Atomic performSpin
exports.performSpin = async (uid, spinType = 'free') => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let user = await SpinUser.findOne({ uid }).session(session);
    if (!user) {
      user = (await SpinUser.create([{ uid, free_spin_available: true }], { session }))[0];
    }

    // validate availability
    if (spinType === 'free' && !user.free_spin_available) {
      throw new Error('No free spin available');
    }
    if (spinType === 'bonus' && user.bonus_spins <= 0) {
      throw new Error('No bonus spins left');
    }

    // pick reward
    const reward = pickReward(rewardsConfig.rewards || []);

    // create history
    await SpinHistory.create([{
      uid,
      reward_type: reward.type || 'coin',
      reward_value: reward.value || 0,
      reward_code: reward.code || null,
      reward_label: reward.label || 'Reward',
      timestamp: new Date()
    }], { session });

    // update wallet if coin reward
    if (reward.type === 'coin' && reward.value) {
      await Wallet.findOneAndUpdate(
        { uid },
        { $inc: { coins: reward.value }, $set: { last_updated: new Date() } },
        { upsert: true, new: true, session }
      );
    }

    // update user spin flags
    const updates = {};
    if (spinType === 'free') {
      updates.free_spin_available = false;
      updates.free_spin_used_at = new Date();
    } else if (spinType === 'bonus') {
      updates.bonus_spins = Math.max(0, (user.bonus_spins || 0) - 1);
    }
    updates.updated_at = new Date();
    await SpinUser.updateOne({ uid }, { $set: updates }, { session });

    await session.commitTransaction();
    session.endSession();

    return { success: true, reward };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

// Admin-reset: mark eligible users with free_spin_available=true and update last_free_spin_given
exports.runDailyReset = async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const res = await SpinUser.updateMany(
    {
      $or: [
        { last_free_spin_given: { $exists: false } },
        { last_free_spin_given: null },
        { last_free_spin_given: { $lt: cutoff } }
      ]
    },
    {
      $set: { free_spin_available: true, last_free_spin_given: new Date() }
    }
  );
  return res;
};

// Save FCM token
exports.registerFcmToken = async (uid, token) => {
  if (!uid || !token) throw new Error('uid and token required');
  await SpinUser.updateOne({ uid }, { $addToSet: { fcm_tokens: token } }, { upsert: true });
  return true;
};

// Notify users with free_spin_available (requires firebase-admin initialized in controller)
exports.getUsersToNotify = async () => {
  return await SpinUser.find({ free_spin_available: true, fcm_tokens: { $exists: true, $ne: [] } });
};
