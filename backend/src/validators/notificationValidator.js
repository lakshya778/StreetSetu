import mongoose from 'mongoose';

function validationError(details) {
  const error = new Error('The notification request is invalid');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function validateNotificationList(req, res, next) {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  const details = [];

  if (page < 1) details.push({ field: 'page', message: 'Page must be a positive integer' });
  if (limit < 1 || limit > 100) details.push({ field: 'limit', message: 'Limit must be between 1 and 100' });
  if (req.query.complaintId && !mongoose.isValidObjectId(req.query.complaintId)) {
    details.push({ field: 'complaintId', message: 'Complaint id must be valid' });
  }
  if (req.query.unread !== undefined && !['true', 'false'].includes(req.query.unread)) {
    details.push({ field: 'unread', message: 'Unread must be true or false' });
  }
  if (details.length > 0) return next(validationError(details));

  req.notificationQuery = {
    page,
    limit,
    complaintId: req.query.complaintId,
    unread: req.query.unread === 'true'
  };
  return next();
}