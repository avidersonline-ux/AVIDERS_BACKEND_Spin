module.exports.assignDriver = async function (pickup) {
    return {
        id: "DR001",
        name: "Aviders Driver",
        phone: "9876543210",
        vehicleType: "Bike",
        lat: pickup.lat,
        lng: pickup.lng
    };
};
