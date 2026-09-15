import mongoose from 'mongoose';

function validationError(details) {
  const error = new Error('The AI classification request is invalid');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function validateComplaintClassification(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(validationError([{ field: 'id', message: 'Complaint id must be valid' }]));
  }
  return next();
}