import mongoose from 'mongoose';

export function validateAuditQuery(req, res, next) {
  const details = [];
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  if (page < 1) details.push({ field: 'page', message: 'Page must be positive' });
  if (limit < 1 || limit > 100) details.push({ field: 'limit', message: 'Limit must be between 1 and 100' });
  if (req.query.actorId && !mongoose.isValidObjectId(req.query.actorId)) details.push({ field: 'actorId', message: 'Actor id must be valid' });
  if (req.query.search !== undefined && (typeof req.query.search !== 'string' || req.query.search.length > 120)) details.push({ field: 'search', message: 'Search must be at most 120 characters' });
  if (req.query.action !== undefined && (typeof req.query.action !== 'string' || req.query.action.length > 120)) details.push({ field: 'action', message: 'Action filter is invalid' });
  if (req.query.entityType !== undefined && !['complaint', 'user', 'assignment', 'notification'].includes(req.query.entityType)) details.push({ field: 'entityType', message: 'Entity type is invalid' });
  if (details.length) {
    const error = new Error('The audit query is invalid');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = details;
    return next(error);
  }
  req.auditQuery = { page, limit, actorId: req.query.actorId, action: req.query.action, entityType: req.query.entityType, search: req.query.search?.trim() };
  return next();
}
