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
  if (!Array.isArray(attachments) || attachments.length < 1 || attachments.length > 5) {
    details.push({ field: 'attachments', message: 'Between 1 and 5 live camera photos are required' });
    return;
  }

  attachments.forEach((attachment, index) => {
    if (!attachment || typeof attachment.url !== 'string' || !attachment.url.trim()) {
      details.push({ field: `attachments.${index}.url`, message: 'Attachment URL is required' });
    }
    if (!attachment || !MIME_TYPES.has(attachment.mimeType)) {
      details.push({ field: `attachments.${index}.mimeType`, message: 'Only JPEG, PNG, and WebP images are supported' });
    }
    if (attachment?.size !== undefined && (!Number.isInteger(attachment.size) || attachment.size < 0 || attachment.size > 5 * 1024 * 1024)) {
      details.push({ field: `attachments.${index}.size`, message: 'Attachment size must be between 0 and 5 MB' });
    }
    if (attachment?.captureSource !== 'live_camera'
      || attachment?.imageMetadata?.captureSource !== attachment?.captureSource) {
      details.push({ field: `attachments.${index}.captureSource`, message: 'Live camera capture required' });
    }
    if (!/^[a-f\d]{64}$/i.test(attachment?.proofHash || '')) {
      details.push({ field: `attachments.${index}.proofHash`, message: 'A valid server evidence hash is required' });
    }
    if (attachment?.captureSource === 'live_camera') {
      const metadata = attachment.imageMetadata || {};
      const capturedAt = new Date(metadata.capturedAt);
      if (!Number.isFinite(metadata.latitude) || metadata.latitude < -90 || metadata.latitude > 90
        || !Number.isFinite(metadata.longitude) || metadata.longitude < -180 || metadata.longitude > 180
        || !Number.isFinite(metadata.accuracy) || metadata.accuracy < 0
        || typeof metadata.capturedAt !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(metadata.capturedAt)
        || Number.isNaN(capturedAt.getTime())) {
        details.push({ field: `attachments.${index}.imageMetadata`, message: 'Valid live camera metadata is required' });
      }
    }
    if (attachment?.evidenceFlag !== undefined
      && !['location_mismatch', 'time_mismatch'].includes(attachment.evidenceFlag)) {
      details.push({ field: `attachments.${index}.evidenceFlag`, message: 'Evidence review flag is invalid' });
    }
  });
}

function validateComplaintPayload(req, res, next, requireEvidence) {
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
  if (body.isAnonymous !== undefined && typeof body.isAnonymous !== 'boolean') {
    details.push({ field: 'isAnonymous', message: 'Anonymous reporting must be a boolean' });
  }
  if (body.wardId !== undefined && (typeof body.wardId !== 'string' || !/^[a-f\d]{24}$/i.test(body.wardId))) {
    details.push({ field: 'wardId', message: 'Ward id must be a valid identifier' });
  }
  for (const field of ['city', 'area']) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].trim().length > (field === 'city' ? 120 : 160))) {
      details.push({ field, message: `${field} must be a string within the allowed length` });
    }
  }
  const normalizedLocation = validateLocation(body, details);
  if (requireEvidence) validateAttachments(body.attachments, details);

  if (details.length > 0) return next(validationError(details));
  req.body = {
    title,
    description,
    category: body.category,
    priority: body.priority || 'medium',
    isAnonymous: body.isAnonymous === true,
    location: normalizedLocation.location,
    longitude: normalizedLocation.longitude,
    latitude: normalizedLocation.latitude,
    wardId: body.wardId,
    address: typeof body.address === 'string' ? body.address.trim() : undefined,
    city: typeof body.city === 'string' ? body.city.trim() : undefined,
    area: typeof body.area === 'string' ? body.area.trim() : undefined,
    attachments: body.attachments || [],
    allowDuplicate: body.allowDuplicate === true
  };
  return next();
}

export function validateCreateComplaint(req, res, next) {
  return validateComplaintPayload(req, res, next, true);
}

export function validateDuplicateCheck(req, res, next) {
  return validateComplaintPayload(req, res, next, false);
}

export function validateStatusUpdate(req, res, next) {
  const details = [];
  if (!COMPLAINT_STATUSES.includes(req.body?.status)) {
    details.push({ field: 'status', message: `Status must be one of: ${COMPLAINT_STATUSES.join(', ')}` });
  }
  if (req.body?.note !== undefined && (typeof req.body.note !== 'string' || req.body.note.trim().length > 1000)) {
    details.push({ field: 'note', message: 'Note must be at most 1000 characters' });
  }
  if (req.body?.status === 'rejected'
    && (typeof req.body.note !== 'string' || req.body.note.trim().length === 0)) {
    details.push({ field: 'note', message: 'A rejection reason is required' });
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
  const status = typeof query.status === 'string' ? query.status.trim() || undefined : undefined;
  const category = typeof query.category === 'string' ? query.category.trim() || undefined : undefined;
  const priority = typeof query.priority === 'string' ? query.priority.trim() || undefined : undefined;
  const search = typeof query.search === 'string' ? query.search.trim() || undefined : undefined;
  const fromDate = typeof query.from === 'string' && query.from ? new Date(query.from) : undefined;
  const toDate = typeof query.to === 'string' && query.to ? new Date(query.to) : undefined;

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
  for (const field of ['status', 'category', 'priority', 'search', 'from', 'to']) {
    if (query[field] !== undefined && typeof query[field] !== 'string') details.push({ field, message: `${field} must be a string` });
  }
  if (search !== undefined && search.length > 120) details.push({ field: 'search', message: 'Search must be at most 120 characters' });
  if (query.from !== undefined && Number.isNaN(fromDate.getTime())) details.push({ field: 'from', message: 'From must be a valid date' });
  if (query.to !== undefined && Number.isNaN(toDate.getTime())) details.push({ field: 'to', message: 'To must be a valid date' });
  if (fromDate && toDate && fromDate > toDate) details.push({ field: 'to', message: 'To date must be after from date' });
  if (query.assignedTo !== undefined && (typeof query.assignedTo !== 'string' || !/^[a-f\d]{24}$/i.test(query.assignedTo))) {
    details.push({ field: 'assignedTo', message: 'Assigned user id must be valid' });
  }
  if (details.length > 0) return next(validationError(details));
  req.query.status = status;
  req.query.category = category;
  req.query.priority = priority;
  req.query.search = search;
  req.query.fromDate = fromDate;
  req.query.toDate = toDate;
  return next();
}
