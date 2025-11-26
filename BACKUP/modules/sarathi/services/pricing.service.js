function calculatePricing(mode, distanceKm, durationMin, parcelType, weight) {
  if (mode === "ride") {
    return (
      Number(process.env.RIDE_BASE) +
      distanceKm * Number(process.env.RIDE_PER_KM) +
      durationMin * Number(process.env.RIDE_PER_MIN)
    );
  }

  if (mode === "parcel") {
    return (
      Number(process.env.PARCEL_BASE) +
      distanceKm * Number(process.env.PARCEL_PER_KM) +
      durationMin * Number(process.env.PARCEL_PER_MIN)
    );
  }

  return 0;
}

module.exports = { calculatePricing };
