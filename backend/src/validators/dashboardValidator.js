import mongoose from 'mongoose';

function validationError(details) {
  const error = new Error('The dashboard query is invalid');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function validateDashboardQuery(req, res, next) {
  const { wardId, from, to } = req.query;
  const details = [];
  let fromDate;
  let toDate;

  if (wardId !== undefined && !mongoose.isValidObjectId(wardId)) {
    details.push({ field: 'wardId', message: 'Ward id must be a valid identifier' });
  }
  if (from !== undefined) {
    fromDate = new Date(from);
    if (Number.isNaN(fromDate.getTime())) {
      details.push({ field: 'from', message: 'From must be a valid ISO date' });
    }
  }
  if (to !== undefined) {
    toDate = new Date(to);
    if (Number.isNaN(toDate.getTime())) {
      details.push({ field: 'to', message: 'To must be a valid ISO date' });
    }
  }
  if (fromDate && toDate && fromDate > toDate) {
    details.push({ field: 'dateRange', message: 'From must be earlier than or equal to to' });
  }
  if (details.length > 0) return next(validationError(details));

  req.dashboardQuery = {
    wardId: wardId ? new mongoose.Types.ObjectId(wardId) : undefined,
    fromDate,
    toDate
  };
  return next();
}
