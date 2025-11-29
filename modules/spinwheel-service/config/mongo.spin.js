const mongoose = require('mongoose');

const connectSpinMongo = async () => {
  try {
    // Use a different database name for spin wheel
    const spinDb = mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://localhost:27017/spin_wheel', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    spinDb.on('connected', () => {
      console.log('✅ Spin Wheel MongoDB Connected');
    });
    
    spinDb.on('error', (err) => {
      console.error('❌ Spin Wheel MongoDB connection error:', err);
    });
    
    // Make spinDb available to models
    module.exports = spinDb;
    
  } catch (error) {
    console.error('❌ Spin Wheel MongoDB connection failed:', error.message);
  }
};

module.exports = connectSpinMongo;
