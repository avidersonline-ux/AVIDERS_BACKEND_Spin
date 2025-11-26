module.exports = {
  generateReward() {
    const rewards = [
      { type: "coins", value: 10, chance: 30 },
      { type: "coins", value: 20, chance: 25 },
      { type: "coins", value: 50, chance: 15 },
      { type: "coins", value: 100, chance: 10 },
      { type: "coupon", code: "AVD10", chance: 10 },
      { type: "coins", value: 500, chance: 5 },
      { type: "none", value: 0, chance: 5 }
    ];

    const rand = Math.random() * 100;
    let acc = 0;

    for (const r of rewards) {
      acc += r.chance;
      if (rand <= acc) return r;
    }

    return rewards[0];
  }
};
