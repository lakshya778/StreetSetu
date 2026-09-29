import { listAuditLogs } from '../services/auditQueryService.js';

export async function list(req, res, next) {
  try { return res.json({ success: true, data: await listAuditLogs(req.auditQuery || req.query) }); }
  catch (error) { return next(error); }
}
