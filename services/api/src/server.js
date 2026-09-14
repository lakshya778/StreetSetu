const app = require('./app');
const { connectDatabase } = require('./config/database');
const env = require('./config/env');
const logger = require('./config/logger');

async function startServer() {
  try {
    await connectDatabase();

    app.listen(env.PORT, () => {
      logger.info(`StreetSetu API running on port ${env.PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
