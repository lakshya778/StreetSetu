export function errorHandler(error, req, res, next) {
  const isDuplicate = error?.code === 11000;
  const isMongooseValidation = error?.name === 'ValidationError';
  const isCastError = error?.name === 'CastError';
  const isMulterError = error?.name === 'MulterError';
  const isUploadLimitError = isMulterError && error.code === 'LIMIT_FILE_SIZE';
  const statusCode = error.statusCode || (isDuplicate
    ? 409
    : isUploadLimitError
      ? 413
      : isMongooseValidation || isCastError || isMulterError ? 400 : 500);
  const response = {
    success: false,
    error: {
      code: isDuplicate
        ? 'CONFLICT'
        : isUploadLimitError
          ? 'UPLOAD_TOO_LARGE'
          : isMulterError
            ? 'UPLOAD_VALIDATION_ERROR'
            : isMongooseValidation || isCastError
              ? 'VALIDATION_ERROR'
            : error.code || 'INTERNAL_SERVER_ERROR',
      message: statusCode >= 500 ? 'An unexpected error occurred' : error.message
    }
  };

  if (error.details) {
    response.error.details = error.details;
  } else if (isMongooseValidation) {
    response.error.details = Object.values(error.errors).map((validationError) => ({
      field: validationError.path,
      message: validationError.message
    }));
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  return res.status(statusCode).json(response);
}