
const dns = require('dns');

// MongoDB Atlas DNS Configuration
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI;

    if (!uri) {
      throw new Error(
        'MONGO_URI or MONGODB_URI is not configured in .env'
      );
    }

    mongoose.set('strictQuery', true);

    console.log('Connecting to MongoDB Atlas...');

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000,
      family: 4
    });

    console.log('----------------------------------');
    console.log('MongoDB Connected Successfully!');
    console.log(`Database: ${mongoose.connection.name}`);
    console.log(`Host: ${mongoose.connection.host}`);
    console.log('----------------------------------');

  } catch (error) {
    console.error('MongoDB Connection Failed!');
    console.error('Error:', error.message);
    throw error;
  }
};

module.exports = connectDB;
