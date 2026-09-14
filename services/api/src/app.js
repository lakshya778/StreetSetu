const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const logger = require('./config/logger');
const { responseFormatter } = require('./utils/responseFormatter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const workerRoutes = require('./routes/workerRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

app.get('/health', (req, res) => {
  return responseFormatter(res, 200, { status: 'ok' }, 'Service healthy');
});

app.use(`${env.API_PREFIX}/auth`, authRoutes);
app.use(`${env.API_PREFIX}/complaints`, complaintRoutes);
app.use(`${env.API_PREFIX}/workers`, workerRoutes);
app.use(`${env.API_PREFIX}/notifications`, notificationRoutes);

app.use((req, res, next) => {
  res.locals.requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.round(Math.random() * 100000)}`;
  next();
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
