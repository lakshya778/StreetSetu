function trustedOrigins() {
  return [process.env.CLIENT_ORIGIN, ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',')]
    .map((origin) => origin?.trim()).filter(Boolean);
}

export function requireTrustedBrowserOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  const allowed = trustedOrigins();
  if (allowed.length && allowed.includes(origin)) return next();
  if (!allowed.length && process.env.NODE_ENV !== 'production') return next();
  return res.status(403).json({
    success: false,
    error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This browser origin is not allowed to perform authentication actions.' },
    meta: { requestId: req.id, timestamp: new Date().toISOString() }
  });
}
