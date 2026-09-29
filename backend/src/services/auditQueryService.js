import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';

export async function listAuditLogs(query = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  const filter = {};
  if (query.action) filter.action = query.action;
  if (query.entityType) filter.entityType = query.entityType;
  if (query.actorId && mongoose.isValidObjectId(query.actorId)) filter.actor = query.actorId;
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ action: { $regex: escaped, $options: 'i' } }, { entityType: { $regex: escaped, $options: 'i' } }];
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('actor', 'name email role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter)
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) || 1 };
}
