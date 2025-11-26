// VERY simple in-memory model for starter. Replace with DB integration.
const trips = new Map();


module.exports = {
create: async (obj) => {
const now = new Date().toISOString();
const rec = { ...obj, created_at: now };
trips.set(rec.id, rec);
return rec;
},
findById: async (id) => {
return trips.get(id) || null;
},
updateStatus: async (id, status) => {
const t = trips.get(id);
if (!t) return null;
t.status = status;
t.updated_at = new Date().toISOString();
trips.set(id, t);
return t;
},
complete: async (id, distance_km, duration_min) => {
const t = trips.get(id);
if (!t) return null;
t.status = 'COMPLETED';
t.distance_km = distance_km;
t.duration_min = duration_min;
t.final_fare = Math.max(30, (distance_km * 8) + (duration_min * 1)); // naive fare
t.ended_at = new Date().toISOString();
trips.set(id, t);
return t;
}
};