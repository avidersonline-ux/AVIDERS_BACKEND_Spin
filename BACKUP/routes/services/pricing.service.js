const Tariff = require('../../models/mobility/Tariff');


exports.estimateFare = async (pickup, drop, vehicle_type) => {
// naive Haversine distance (km)
function haversine(a, b){
const R = 6371; // km
const toRad = x => x * Math.PI / 180;
const dLat = toRad(b.lat - a.lat);
const dLon = toRad(b.lng - a.lng);
const lat1 = toRad(a.lat); const lat2 = toRad(b.lat);
const sinDLat = Math.sin(dLat/2);
const sinDLon = Math.sin(dLon/2);
const aH = sinDLat*sinDLat + sinDLon*sinDLon * Math.cos(lat1)*Math.cos(lat2);
const c = 2 * Math.atan2(Math.sqrt(aH), Math.sqrt(1-aH));
return R * c;
}


const distance_km = haversine(pickup, drop);
const duration_min = Math.max(1, Math.round(distance_km / 0.5 * 2)); // naive
const tariff = await Tariff.findForCityAndVehicle(null, vehicle_type);
const fare = Math.max(tariff.min_fare, Math.round((tariff.base_fare + tariff.per_km * distance_km + tariff.per_min * duration_min) * tariff.surge));
return { distance_km: Number(distance_km.toFixed(2)), duration_min, est_fare: fare };
};