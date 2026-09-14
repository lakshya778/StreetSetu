const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  eventName: {
    type: String,
    enum: ['complaint.accepted', 'worker.assigned', 'complaint.status.updated', 'complaint.resolved'],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  payload: {
    type: Object,
    default: {},
  },
  provider: {
    type: String,
    enum: ['fcm', 'smtp', 'sms'],
    default: 'fcm',
  },
  pushToken: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['queued', 'sent', 'failed', 'read'],
    default: 'queued',
  },
  sentAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ eventName: 1 });
notificationSchema.index({ provider: 1, status: 1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
