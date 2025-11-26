const axios = require("axios");

async function getDistance(pickupLat, pickupLng, dropLat, dropLng) {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${pickupLat},${pickupLng}&destinations=${dropLat},${dropLng}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  const res = await axios.get(url);

  const data = res.data.rows[0].elements[0];

  return {
    distanceKm: data.distance.value / 1000,
    durationMin: data.duration.value / 60,
  };
}

module.exports = { getDistance };
