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
  const profileFields = {};
  for (const [field, maxLength] of [['phone', 30], ['area', 160], ['city', 120]]) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string' || body[field].trim().length > maxLength) {
        details.push({ field, message: `${field} must be a string within the allowed length` });
      } else profileFields[field] = body[field].trim();
    }
  }
  const allowedAvailability = ['available', 'limited', 'unavailable', 'full_time', 'part_time', 'weekend', 'flexible'];
  if (body.availability !== undefined && !allowedAvailability.includes(body.availability)) {
    details.push({ field: 'availability', message: `Availability must be one of: ${allowedAvailability.join(', ')}` });
  } else if (body.availability !== undefined) profileFields.availability = body.availability;

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
  req.body = { expertiseCategories: [...new Set(expertiseCategories)], ...profileFields, ...(location ? { location } : {}) };
  return next();
}
