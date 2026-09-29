import { randomUUID } from 'node:crypto';

export function requestContext(req, res, next) {
  req.id = req.get('x-request-id')?.slice(0, 100) || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
