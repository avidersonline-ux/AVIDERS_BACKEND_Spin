const mongoose = require('mongoose');

const connectMongo = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/main', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ Main MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Main MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectMongo;
