import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true, index: true, maxlength: 120 },
  entityType: { type: String, required: true, index: true, maxlength: 80 },
  entityId: { type: mongoose.Schema.Types.ObjectId, index: true },
  previousValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  requestId: { type: String, index: true },
  ipAddress: { type: String, maxlength: 100 },
  userAgent: { type: String, maxlength: 500 }
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
export default mongoose.model('AuditLog', auditLogSchema);
