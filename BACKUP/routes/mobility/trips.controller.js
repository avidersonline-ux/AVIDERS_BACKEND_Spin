const Pricing = require('./pricing.controller');
const Dispatch = require('./dispatch.service');

const Trips = {
  async estimate(req, res) {
    try {
      const { pickup, drop, vehicle_type } = req.body;
      const pricing = await Pricing.calculateFare(pickup, drop, vehicle_type);

      return res.json({
        distance_km: pricing.distance,
        duration_min: pricing.duration,
        est_fare: pricing.fare,
      });

    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Estimate error" });
    }
  },

  async requestRide(req, res) {
    try {
      const { pickup, drop, vehicle_type } = req.body;

      // auto assign driver
      const driver = await Dispatch.assignDriver(pickup);

      const trip = {
        id: "TRIP" + Date.now(),
        status: "ASSIGNED",
        pickup,
        drop,
        vehicle_type,
        driver,
      };

      return res.json(trip);

    } catch (e) {
      console.log(e);
      return res.status(500).json({ error: "Ride request failed" });
    }
  },

  async getTrip(req, res) {
    const id = req.params.id;

    return res.json({
      id,
      status: "ON_THE_WAY",
      driver: {
        id: "DR123",
        name: "Rahul",
        phone: "9876543210",
        location: { lat: 12.9716, lng: 77.5946 }
      }
    });
  },
};

module.exports = Trips;
