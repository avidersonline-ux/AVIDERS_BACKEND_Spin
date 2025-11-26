const Dispatch = {
  async assignDriver(pickup) {
    return {
      id: "DR1",
      name: "Suresh",
      phone: "9876543210",
      vehicle: "Bike",
      location: { lat: pickup.lat, lng: pickup.lng }
    };
  }
};

module.exports = Dispatch;
