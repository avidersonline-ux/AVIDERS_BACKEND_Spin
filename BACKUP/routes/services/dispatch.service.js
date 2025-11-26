const Driver = require('../../models/mobility/Driver');


exports.assignDriver = async (trip) => {
// very naive: pick first online driver
const nearby = await Driver.findNearby(trip.pickup_lat, trip.pickup_lng, 5);
if (nearby.length === 0) return null;
const driver = nearby[0];
// update trip with driver (in a real app you'd lock & notify)
trip.driver_id = driver.userId;
trip.status = 'ASSIGNED';
return { driver, trip };
};