// modules/spinwheel-service/engine/rewardEngine.js
const fs = require("fs");
const path = require("path");

function loadConfig() {
  const filePath = path.join(__dirname, "../config/rewards.config.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function pickReward() {
  const config = loadConfig();
  const sectors = config.rewards;

  const total = sectors.reduce((sum, s) => sum + (s.probability || 0), 0);
  const rand = Math.random() * total;

  let acc = 0;
  for (let i = 0; i < sectors.length; i++) {
    acc += sectors[i].probability;
    if (rand <= acc) {
      return { sectorIndex: i, reward: sectors[i] };
    }
  }

  return { sectorIndex: 0, reward: sectors[0] };
}

module.exports = { pickReward, loadConfig };
