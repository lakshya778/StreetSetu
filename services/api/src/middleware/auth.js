const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../config/logger');

function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return next({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication token missing', details: [] });
    }

    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: payload.sub || payload.id,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      wardId: payload.wardId,
      departmentId: payload.departmentId,
    };

    logger.info(`Authenticated request for user ${req.user.id}`);
    return next();
  } catch (error) {
    logger.warn(`Authentication failed: ${error.message}`);
    return next({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Invalid or expired token', details: [] });
  }
}

module.exports = {
  authRequired,
};
