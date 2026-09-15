function validationError(details) {
  const error = new Error('The upload request is invalid');
  error.statusCode = 400;
  error.code = 'UPLOAD_VALIDATION_ERROR';
  error.details = details;
  return error;
}

export function validateImageUpload(req, res, next) {
  if (!Array.isArray(req.files) || req.files.length === 0) {
    return next(validationError([{ field: 'images', message: 'At least one image is required' }]));
  }

  const invalidFiles = req.files
    .map((file, index) => {
      if (!file.buffer || file.size === 0) {
        return { field: `images.${index}`, message: 'Image file is empty' };
      }
      return null;
    })
    .filter(Boolean);

  if (invalidFiles.length > 0) return next(validationError(invalidFiles));
  return next();
}
