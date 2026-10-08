const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function invalid(details) {
  const error = new Error('The request payload is invalid');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function validateDrive(req, res, next) {
  const body = req.body || {};
  const details = [];
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const locationText = typeof body.locationText === 'string' ? body.locationText.trim() : '';
  const date = new Date(body.date);

  if (title.length < 3 || title.length > 120) details.push({ field: 'title', message: 'Title must be between 3 and 120 characters' });
  if (description.length < 5 || description.length > 2000) details.push({ field: 'description', message: 'Description must be between 5 and 2000 characters' });
  if (locationText.length < 2 || locationText.length > 240) details.push({ field: 'locationText', message: 'Location must be between 2 and 240 characters' });
  if (!Number.isFinite(date.getTime()) || date <= new Date()) details.push({ field: 'date', message: 'Choose a valid future date' });

  const hasLat = body.lat !== undefined && body.lat !== '';
  const hasLng = body.lng !== undefined && body.lng !== '';
  if (hasLat !== hasLng) details.push({ field: 'coordinates', message: 'Latitude and longitude must be provided together' });
  const lat = hasLat ? Number(body.lat) : undefined;
  const lng = hasLng ? Number(body.lng) : undefined;
  if (hasLat && (!Number.isFinite(lat) || lat < -90 || lat > 90)) details.push({ field: 'lat', message: 'Latitude must be between -90 and 90' });
  if (hasLng && (!Number.isFinite(lng) || lng < -180 || lng > 180)) details.push({ field: 'lng', message: 'Longitude must be between -180 and 180' });
  if (details.length) return next(invalid(details));

  req.body = { title, description, locationText, date, lat, lng };
  return next();
}

export function validateDriveId(req, res, next) {
  if (!OBJECT_ID_PATTERN.test(req.params.id)) {
    return next(invalid([{ field: 'id', message: 'Drive id must be a valid identifier' }]));
  }
  return next();
}
