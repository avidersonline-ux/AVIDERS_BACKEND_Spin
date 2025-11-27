const fs = require("fs");
const path = require("path");

function loadConfig() {
  const filePath = path.join(__dirname, "../config/rewards.config.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function pickReward() {
  const config = loadConfig();
  const sectors = config.sectors;

  const total = sectors.reduce((sum, s) => sum + (s.chance || 0), 0);
  const rand = Math.random() * total;

  let acc = 0;
  for (let i = 0; i < sectors.length; i++) {
    acc += sectors[i].chance;
    if (rand <= acc) {
      return { sectorIndex: i, reward: sectors[i] };
    }
  }

  return { sectorIndex: 0, reward: sectors[0] };
}

module.exports = { pickReward, loadConfig };
