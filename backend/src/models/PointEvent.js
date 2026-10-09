import mongoose from 'mongoose';

export const POINT_EVENT_TYPES = [
  'report_created',
  'complaint_resolved',
  'drive_joined',
  'drive_organized',
  'support_received'
];

const pointEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: POINT_EVENT_TYPES, required: true },
  points: { type: Number, required: true, min: 1 },
  refType: { type: String, enum: ['complaint', 'drive', 'vote'], required: true },
  refId: { type: mongoose.Schema.Types.ObjectId, required: true },
  month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  createdAt: { type: Date, required: true, default: Date.now }
}, { versionKey: false });

pointEventSchema.index({ user: 1, type: 1, refId: 1 }, { unique: true });
pointEventSchema.index({ month: 1, user: 1 });
pointEventSchema.index({ refType: 1, refId: 1 });

export default mongoose.model('PointEvent', pointEventSchema);
