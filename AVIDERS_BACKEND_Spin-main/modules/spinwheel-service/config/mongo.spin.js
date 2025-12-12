const mongoose = require('mongoose');

const connectSpinMongo = async () => {
  try {
    // For spin wheel, we can use the same connection but different database
    const spinDbUri = process.env.MONGODB_URI ? 
      process.env.MONGODB_URI.replace(/\/[^/?]+(\?|$)/, '/spin_wheel$1') : 
      'mongodb://localhost:27017/spin_wheel';
    
    const conn = await mongoose.createConnection(spinDbUri).asPromise();
    console.log('✅ Spin Wheel MongoDB Connected');
    
    // Make the connection available for models
    module.exports.spinConnection = conn;
    
  } catch (error) {
    console.error('❌ Spin Wheel MongoDB connection error:', error.message);
    console.log('🔄 Spin wheel will use main database connection');
  }
};

module.exports = connectSpinMongo;
