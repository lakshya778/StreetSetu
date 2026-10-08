import * as Sentry from '@sentry/node';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
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
  const errorCode = statusCode >= 500
    ? 'INTERNAL_SERVER_ERROR'
    : isDuplicate
      ? 'CONFLICT'
      : isUploadLimitError
        ? 'UPLOAD_TOO_LARGE'
        : isMulterError
          ? 'UPLOAD_VALIDATION_ERROR'
          : isMongooseValidation || isCastError
            ? 'VALIDATION_ERROR'
            : error.code || 'INTERNAL_SERVER_ERROR';
  const response = {
    success: false,
    error: {
      code: errorCode,
      message: statusCode >= 500 ? 'An unexpected error occurred' : error.message
    }
  };

  if (statusCode < 500 && error.details) {
    response.error.details = error.details;
  } else if (statusCode < 500 && isMongooseValidation) {
    response.error.details = Object.values(error.errors).map((validationError) => ({
      field: validationError.path,
      message: validationError.message
    }));
  }

  const isRegistrationRequest = req.method === 'POST' && /\/auth\/register\/?$/.test(req.originalUrl || '');
  if (statusCode >= 500 || isRegistrationRequest) {
    console.error('[API Error]', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    });
    if (process.env.SENTRY_DSN) Sentry.captureException(error, { extra: { requestId: req.id, path: req.originalUrl, method: req.method } });
  }

  response.meta = { requestId: req.id, timestamp: new Date().toISOString() };
  return res.status(statusCode).json(response);
}
