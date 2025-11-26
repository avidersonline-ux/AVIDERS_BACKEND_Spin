const mongoose = require("mongoose");

const DriverSchema = new mongoose.Schema({
  name: String,
  phone: String,
  active: Boolean,
  lat: Number,
  lng: Number,
});

module.exports = mongoose.model("Driver", DriverSchema);
