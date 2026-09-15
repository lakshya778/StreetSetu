import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES
} from '../models/Complaint.js';

const MAX_RADIUS_METERS = 50000;

function validationError(details) {
  const error = new Error('The location query is invalid');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function validateNearbyComplaints(req, res, next) {
  const details = [];
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const radiusMeters = Number(req.query.radiusMeters || 5000);
  const limit = Number.parseInt(req.query.limit, 10) || 50;

  if (req.query.latitude === undefined || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    details.push({ field: 'latitude', message: 'Latitude must be between -90 and 90' });
  }
  if (req.query.longitude === undefined || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    details.push({ field: 'longitude', message: 'Longitude must be between -180 and 180' });
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > MAX_RADIUS_METERS) {
    details.push({ field: 'radiusMeters', message: `Radius must be greater than 0 and at most ${MAX_RADIUS_METERS} meters` });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    details.push({ field: 'limit', message: 'Limit must be an integer between 1 and 100' });
  }
  if (req.query.status !== undefined && !COMPLAINT_STATUSES.includes(req.query.status)) {
    details.push({ field: 'status', message: `Status must be one of: ${COMPLAINT_STATUSES.join(', ')}` });
  }
  if (req.query.category !== undefined && !COMPLAINT_CATEGORIES.includes(req.query.category)) {
    details.push({ field: 'category', message: `Category must be one of: ${COMPLAINT_CATEGORIES.join(', ')}` });
  }
  if (req.query.priority !== undefined && !COMPLAINT_PRIORITIES.includes(req.query.priority)) {
    details.push({ field: 'priority', message: `Priority must be one of: ${COMPLAINT_PRIORITIES.join(', ')}` });
  }
  if (details.length > 0) return next(validationError(details));

  req.geoQuery = { latitude, longitude, radiusMeters, limit };
  return next();
}