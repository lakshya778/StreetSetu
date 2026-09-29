import AuditLog from '../models/AuditLog.js';

export function recordAudit({ req, actorId = req?.user?.sub, action, entityType, entityId, previousValue, newValue, metadata = {} }) {
  return AuditLog.create({
    actor: actorId || undefined,
    action,
    entityType,
    entityId,
    previousValue,
    newValue,
    metadata,
    requestId: req?.id,
    ipAddress: req?.ip,
    userAgent: req?.get?.('user-agent')
  });
}
