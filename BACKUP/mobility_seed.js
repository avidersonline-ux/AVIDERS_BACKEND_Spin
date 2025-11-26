// Seed some drivers for testing
const Driver = require('./models/mobility/Driver');
(async () => {
await Driver.setOnline('driver-1', true);
await Driver.updateLocation('driver-1', 12.9352, 77.6245);


await Driver.setOnline('driver-2', true);
await Driver.updateLocation('driver-2', 12.9359, 77.6200);


console.log('seeded drivers');
})();