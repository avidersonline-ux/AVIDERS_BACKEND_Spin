const { getDistance } = require("../services/distance.service");
const { calculatePricing } = require("../services/pricing.service");

exports.getEstimate = async (req, res) => {
  try {
    const {
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      mode,
      parcelType,
      weight,
    } = req.body;

    const { distanceKm, durationMin } = await getDistance(
      pickupLat,
      pickupLng,
      dropLat,
      dropLng
    );

    const estimatedFare = calculatePricing(
      mode,
      distanceKm,
      durationMin,
      parcelType,
      weight
    );

    res.json({
      distanceKm,
      durationMin,
      estimatedFare,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
