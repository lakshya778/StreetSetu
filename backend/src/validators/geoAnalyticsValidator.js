import { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES } from '../models/Complaint.js';

function validationError(details) {
  const error = new Error('The geographic analytics query is invalid');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function validateGeoAnalyticsQuery(req, res, next) {
  const { category, status, from, to, kind } = req.query;
  const details = [];
  if (category !== undefined && !COMPLAINT_CATEGORIES.includes(category)) details.push({ field: 'category', message: 'Category is invalid' });
  if (status !== undefined && !COMPLAINT_STATUSES.includes(status)) details.push({ field: 'status', message: 'Status is invalid' });
  const fromDate = from === undefined ? undefined : new Date(from);
  const toDate = to === undefined ? undefined : new Date(to);
  if (from !== undefined && (typeof from !== 'string' || Number.isNaN(fromDate?.getTime()))) details.push({ field: 'from', message: 'From must be a valid ISO date' });
  if (to !== undefined && (typeof to !== 'string' || Number.isNaN(toDate?.getTime()))) details.push({ field: 'to', message: 'To must be a valid ISO date' });
  if (fromDate && toDate && fromDate > toDate) details.push({ field: 'dateRange', message: 'From must be earlier than or equal to to' });
  if (kind !== undefined && !['all', 'resolved', 'rejected'].includes(kind)) details.push({ field: 'kind', message: 'Kind must be all, resolved, or rejected' });
  if (details.length) return next(validationError(details));
  req.geoAnalyticsQuery = { category, status, from, to, kind: kind || 'all' };
  return next();
}
