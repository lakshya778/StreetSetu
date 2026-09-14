const logger = require('../config/logger');

function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  logger.error(`${code}: ${err.message}`);

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message || 'Internal server error',
      details: err.details || [],
    },
    meta: {
      requestId: res.locals.requestId || req.headers['x-request-id'] || 'unknown',
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
