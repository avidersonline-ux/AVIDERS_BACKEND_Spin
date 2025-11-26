const Drivers = {
  async updateLocation(req, res) {
    const { driverId, lat, lng } = req.body;
    console.log("Driver location updated:", driverId, lat, lng);

    return res.json({ success: true });
  },

  async getNearbyDrivers(req, res) {
    return res.json([
      {
        id: "DR1",
        name: "Suresh",
        location: { lat: 12.9719, lng: 77.6412 },
        distance: 1.2
      },
      {
        id: "DR2",
        name: "Kumar",
        location: { lat: 12.9725, lng: 77.6317 },
        distance: 2.0
      }
    ]);
  },
};

module.exports = Drivers;
