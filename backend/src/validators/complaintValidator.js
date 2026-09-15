import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES
} from '../models/Complaint.js';

const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validationError(details) {
  const error = new Error('The request payload is invalid');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

function validateLocation(body, details) {
  const hasCoordinates = body.latitude !== undefined || body.longitude !== undefined;
  const hasGeoJson = body.location !== undefined;
  let longitude;
  let latitude;

  if (hasGeoJson) {
    if (body.location?.type !== 'Point' || !Array.isArray(body.location.coordinates)
      || body.location.coordinates.length !== 2) {
      details.push({ field: 'location', message: 'A GeoJSON Point with [longitude, latitude] is required' });
      return;
    }
    [longitude, latitude] = body.location.coordinates;
  } else if (hasCoordinates) {
    longitude = body.longitude;
    latitude = body.latitude;
  } else {
    details.push({ field: 'location', message: 'Location coordinates are required' });
    return;
  }

  if (hasCoordinates && (body.longitude !== longitude || body.latitude !== latitude)) {
    details.push({ field: 'location', message: 'GeoJSON and latitude/longitude values must match' });
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    details.push({ field: 'location', message: 'Coordinates must be [longitude, latitude] within valid ranges' });
  }

  return { longitude, latitude, location: { type: 'Point', coordinates: [longitude, latitude] } };
}

function validateAttachments(attachments, details) {
  if (attachments === undefined) return;
  if (!Array.isArray(attachments) || attachments.length > 10) {
    details.push({ field: 'attachments', message: 'Attachments must be an array with at most 10 items' });
    return;
  }

  attachments.forEach((attachment, index) => {
    if (!attachment || typeof attachment.url !== 'string' || !attachment.url.trim()) {
      details.push({ field: `attachments.${index}.url`, message: 'Attachment URL is required' });
    }
    if (!attachment || !MIME_TYPES.has(attachment.mimeType)) {
      details.push({ field: `attachments.${index}.mimeType`, message: 'Only JPEG, PNG, and WebP images are supported' });
    }
    if (attachment?.size !== undefined && (!Number.isInteger(attachment.size) || attachment.size < 0)) {
      details.push({ field: `attachments.${index}.size`, message: 'Attachment size must be a non-negative integer' });
    }
  });
}

export function validateCreateComplaint(req, res, next) {
  const body = req.body || {};
  const details = [];
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (title.length < 5 || title.length > 160) {
    details.push({ field: 'title', message: 'Title must be between 5 and 160 characters' });
  }
  if (description.length < 10 || description.length > 5000) {
    details.push({ field: 'description', message: 'Description must be between 10 and 5000 characters' });
  }
  if (!COMPLAINT_CATEGORIES.includes(body.category)) {
    details.push({ field: 'category', message: `Category must be one of: ${COMPLAINT_CATEGORIES.join(', ')}` });
  }
  if (body.priority !== undefined && !COMPLAINT_PRIORITIES.includes(body.priority)) {
    details.push({ field: 'priority', message: `Priority must be one of: ${COMPLAINT_PRIORITIES.join(', ')}` });
  }
  if (body.wardId !== undefined && (typeof body.wardId !== 'string' || !/^[a-f\d]{24}$/i.test(body.wardId))) {
    details.push({ field: 'wardId', message: 'Ward id must be a valid identifier' });
  }
  const normalizedLocation = validateLocation(body, details);
  validateAttachments(body.attachments, details);

  if (details.length > 0) return next(validationError(details));
  req.body = {
    title,
    description,
    category: body.category,
    priority: body.priority || 'medium',
    location: normalizedLocation.location,
    longitude: normalizedLocation.longitude,
    latitude: normalizedLocation.latitude,
    wardId: body.wardId,
    address: typeof body.address === 'string' ? body.address.trim() : undefined,
    attachments: body.attachments || []
  };
  return next();
}

export function validateStatusUpdate(req, res, next) {
  const details = [];
  if (!COMPLAINT_STATUSES.includes(req.body?.status)) {
    details.push({ field: 'status', message: `Status must be one of: ${COMPLAINT_STATUSES.join(', ')}` });
  }
  if (req.body?.note !== undefined && (typeof req.body.note !== 'string' || req.body.note.trim().length > 1000)) {
    details.push({ field: 'note', message: 'Note must be at most 1000 characters' });
  }
  if (details.length > 0) return next(validationError(details));
  req.body = { status: req.body.status, note: req.body.note?.trim() };
  return next();
}

export function validateAssignment(req, res, next) {
  const assigneeId = req.body?.assigneeId;
  if (typeof assigneeId !== 'string' || !/^[a-f\d]{24}$/i.test(assigneeId)) {
    return next(validationError([{ field: 'assigneeId', message: 'A valid assignee id is required' }]));
  }
  req.body = { assigneeId };
  return next();
}

export function validateListComplaints(req, res, next) {
  const details = [];
  const query = req.query;
  const page = Number.parseInt(query.page, 10);
  const limit = Number.parseInt(query.limit, 10);
  const status = query.status?.trim() || undefined;
  const category = query.category?.trim() || undefined;
  const priority = query.priority?.trim() || undefined;

  if (query.page !== undefined && (!Number.isInteger(page) || page < 1)) {
    details.push({ field: 'page', message: 'Page must be a positive integer' });
  }
  if (query.limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    details.push({ field: 'limit', message: 'Limit must be an integer between 1 and 100' });
  }
  if (status !== undefined && !COMPLAINT_STATUSES.includes(status)) {
    details.push({ field: 'status', message: `Status must be one of: ${COMPLAINT_STATUSES.join(', ')}` });
  }
  if (category !== undefined && !COMPLAINT_CATEGORIES.includes(category)) {
    details.push({ field: 'category', message: `Category must be one of: ${COMPLAINT_CATEGORIES.join(', ')}` });
  }
  if (priority !== undefined && !COMPLAINT_PRIORITIES.includes(priority)) {
    details.push({ field: 'priority', message: `Priority must be one of: ${COMPLAINT_PRIORITIES.join(', ')}` });
  }
  if (query.assignedTo !== undefined && !/^[a-f\d]{24}$/i.test(query.assignedTo)) {
    details.push({ field: 'assignedTo', message: 'Assigned user id must be valid' });
  }
  if (details.length > 0) return next(validationError(details));
  req.query.status = status;
  req.query.category = category;
  req.query.priority = priority;
  return next();
}
