import mongoose from 'mongoose';
import { VOLUNTEER_WORKFLOW_STATUSES } from '../models/Complaint.js';

function validationError(details) {
  const error = new Error('The assignment request is invalid');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

function validId(value) {
  return typeof value === 'string' && mongoose.isValidObjectId(value);
}

function validateVolunteerId(req, res, next) {
  if (!validId(req.body?.volunteerId)) {
    return next(validationError([{ field: 'volunteerId', message: 'A valid volunteer id is required' }]));
  }
  req.body = { volunteerId: req.body.volunteerId };
  return next();
}

export function validateAssignment(req, res, next) {
  return validateVolunteerId(req, res, next);
}

export function validateReassignment(req, res, next) {
  return validateVolunteerId(req, res, next);
}

export function validateWorkflowStatus(req, res, next) {
  const status = typeof req.body?.status === 'string' ? req.body.status.toLowerCase() : '';
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
  const details = [];

  if (!VOLUNTEER_WORKFLOW_STATUSES.includes(status)) {
    details.push({ field: 'status', message: `Status must be one of: ${VOLUNTEER_WORKFLOW_STATUSES.join(', ')}` });
  }
  if (req.body?.note !== undefined && (typeof req.body.note !== 'string' || note.length > 1000)) {
    details.push({ field: 'note', message: 'Note must be at most 1000 characters' });
  }
  if (details.length > 0) return next(validationError(details));
  req.body = { status, note };
  return next();
}
