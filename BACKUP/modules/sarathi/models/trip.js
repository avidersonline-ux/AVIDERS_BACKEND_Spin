const mongoose = require("mongoose");

const TripSchema = new mongoose.Schema({
  userId: String,
  pickup: {
    lat: Number,
    lng: Number,
  },
  drop: {
    lat: Number,
    lng: Number,
  },
  mode: String, // ride | parcel
  parcelType: String,
  weight: Number,

  distanceKm: Number,
  durationMin: Number,
  estimatedFare: Number,

  driverId: { type: String, default: null },
  status: {
    type: String,
    default: "pending", // pending, accepted, picked, delivered, completed
  },
});

module.exports = mongoose.model("Trip", TripSchema);
