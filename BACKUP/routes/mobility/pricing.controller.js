const axios = require('axios');

const Pricing = {
  async calculateFare(pickup, drop, vehicle_type) {
    const distance = 4.8; // km (dummy for now)
    const duration = 12; // min

    let base = 25;
    let per_km = 8;
    let per_min = 1;

    return {
      distance,
      duration,
      fare: Math.round(base + (distance * per_km) + (duration * per_min)),
    };
  },

  async testPricing(req, res) {
    const data = await Pricing.calculateFare({}, {}, "bike");
    return res.json(data);
  }
};

module.exports = Pricing;
