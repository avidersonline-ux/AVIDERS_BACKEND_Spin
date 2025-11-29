const mongoose = require('mongoose');

const connectMongo = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/main');
    console.log(`✅ Main MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Main MongoDB connection error:', error.message);
    // Don't exit the process, let the server continue running
    console.log('🔄 Server will continue without MongoDB connection');
  }
};

module.exports = connectMongo;
