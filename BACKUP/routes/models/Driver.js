// Simple in-memory drivers store for testing.
const drivers = new Map();


module.exports = {
setOnline: async (userId, online) => {
const d = drivers.get(userId) || { userId };
d.online = !!online;
d.last_online_at = new Date().toISOString();
drivers.set(userId, d);
return d;
},
updateLocation: async (userId, lat, lng) => {
const d = drivers.get(userId) || { userId };
d.lat = lat; d.lng = lng; d.updated_at = new Date().toISOString();
drivers.set(userId, d);
return d;
},
findByUserId: async (userId) => drivers.get(userId) || null,
findNearby: async (lat, lng, radiusKm = 5) => {
// naive: return all online drivers
return Array.from(drivers.values()).filter(d => d.online);
}
};