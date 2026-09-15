import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = ['in_app', 'email'];
export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed', 'read'];

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: 'pending', index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date },
    sentAt: { type: Date },
    failureReason: { type: String, maxlength: 1000 }
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ complaint: 1, type: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);