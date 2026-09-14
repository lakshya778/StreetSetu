function responseFormatter(res, statusCode = 200, data = {}, message = 'Operation completed successfully', meta = {}) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    meta: {
      requestId: res.locals.requestId || meta.requestId || 'unknown',
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

module.exports = {
  responseFormatter,
};
