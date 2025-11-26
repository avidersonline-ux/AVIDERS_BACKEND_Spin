const express = require('express');
const router = express.Router();
const verifyJwt = require('../../middleware/verifyJwt');

const Trips = require('./trips.controller');
const Drivers = require('./drivers.controller');
const Pricing = require('./pricing.controller');

// Fare estimate
router.post('/estimate', verifyJwt, Trips.estimate);

// Request ride
router.post('/request', verifyJwt, Trips.requestRide);

// Trip status
router.get('/trip/:id', verifyJwt, Trips.getTrip);

// Driver location update
router.post('/driver/update-location', verifyJwt, Drivers.updateLocation);

// Nearby drivers
router.get('/driver/nearby', verifyJwt, Drivers.getNearbyDrivers);

// Pricing test
router.get('/pricing/test', Pricing.testPricing);

module.exports = router;
