const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

async function connectDatabase() {
  try {
    await mongoose.connect(env.MONGO_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });

    logger.info('MongoDB connection established');
  } catch (error) {
    logger.error('MongoDB connection failed', { message: error.message });
    throw error;
  }
}

async function closeDatabase() {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}

module.exports = {
  connectDatabase,
  closeDatabase,
};
