// Static tariff for starter
module.exports = {
findForCityAndVehicle: async (city, vehicle_type) => ({
base_fare: 30,
per_km: 8,
per_min: 1,
min_fare: 30,
surge: 1,
})
};