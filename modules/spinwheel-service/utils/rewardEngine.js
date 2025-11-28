const fs = require("fs");
const path = require("path");

function loadConfig() {
  const filePath = path.join(__dirname, "../config/rewards.config.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function pickReward() {
  const { rewards } = loadConfig();

  const totalProb = rewards.reduce((sum, r) => sum + r.probability, 0);
  const rand = Math.random() * totalProb;

  let acc = 0;
  for (let i = 0; i < rewards.length; i++) {
    acc += rewards[i].probability;
    if (rand <= acc) {
      return { index: i, reward: rewards[i] };
    }
  }
  return { index: 0, reward: rewards[0] };
}

module.exports = { pickReward, loadConfig };
