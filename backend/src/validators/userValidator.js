import { COMPLAINT_CATEGORIES } from '../models/Complaint.js';

function validationError(details) {
  const error = new Error('The volunteer profile is invalid');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function validateVolunteerProfile(req, res, next) {
  const body = req.body || {};
  const details = [];
  const expertiseCategories = body.expertiseCategories;
  if (!Array.isArray(expertiseCategories) || expertiseCategories.length > COMPLAINT_CATEGORIES.length
    || expertiseCategories.some((category) => !COMPLAINT_CATEGORIES.includes(category))) {
    details.push({ field: 'expertiseCategories', message: 'Choose valid complaint categories for your expertise' });
  }

  const hasLatitude = body.latitude !== undefined;
  const hasLongitude = body.longitude !== undefined;
  let location;
  if (hasLatitude !== hasLongitude) {
    details.push({ field: 'location', message: 'Provide both latitude and longitude' });
  } else if (hasLatitude && (!Number.isFinite(body.latitude) || body.latitude < -90 || body.latitude > 90
    || !Number.isFinite(body.longitude) || body.longitude < -180 || body.longitude > 180)) {
    details.push({ field: 'location', message: 'Coordinates must be within valid latitude and longitude ranges' });
  } else if (hasLatitude) {
    location = { type: 'Point', coordinates: [body.longitude, body.latitude] };
  }

  if (details.length) return next(validationError(details));
  req.body = { expertiseCategories: [...new Set(expertiseCategories)], ...(location ? { location } : {}) };
  return next();
}
