function validationError(details) {
  const error = new Error('Feedback is invalid');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function validateFeedback(req, res, next) {
  const rating = req.body?.rating;
  const comment = req.body?.comment === undefined ? '' : req.body.comment;
  const details = [];
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    details.push({ field: 'rating', message: 'Rating must be a whole number from 1 to 5' });
  }
  if (typeof comment !== 'string' || comment.trim().length > 1000) {
    details.push({ field: 'comment', message: 'Feedback must be text up to 1000 characters' });
  }
  if (details.length) return next(validationError(details));
  req.body = { rating, comment: comment.trim() };
  return next();
}
