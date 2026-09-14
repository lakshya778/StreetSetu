const Notification = require('../models/Notification');
const logger = require('../config/logger');

const eventTemplates = {
  'complaint.accepted': {
    title: 'Complaint Accepted',
    body: 'Your complaint has been accepted by the system.',
    channel: 'fcm',
  },
  'worker.assigned': {
    title: 'Worker Assigned',
    body: 'A worker has been assigned to your complaint.',
    channel: 'fcm',
  },
  'complaint.status.updated': {
    title: 'Complaint Status Updated',
    body: 'Your complaint status has changed.',
    channel: 'fcm',
  },
  'complaint.resolved': {
    title: 'Complaint Resolved',
    body: 'Your complaint has been resolved.',
    channel: 'fcm',
  },
};

async function sendNotification({ userId, eventName, data = {}, pushToken }) {
  if (!eventTemplates[eventName]) {
    const error = new Error('Unsupported notification event');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const template = eventTemplates[eventName];

  const notification = await Notification.create({
    userId,
    eventName,
    title: template.title,
    body: template.body,
    payload: {
      eventName,
      data,
      channel: template.channel,
    },
    provider: 'fcm',
    status: 'queued',
    pushToken: pushToken || null,
    sentAt: null,
  });

  logger.info(`Notification queued for ${eventName} to user ${userId}`);

  return notification;
}

async function sendComplaintAccepted(userId, data = {}) {
  return sendNotification({ userId, eventName: 'complaint.accepted', data });
}

async function sendWorkerAssigned(userId, data = {}) {
  return sendNotification({ userId, eventName: 'worker.assigned', data });
}

async function sendStatusUpdated(userId, data = {}) {
  return sendNotification({ userId, eventName: 'complaint.status.updated', data });
}

async function sendComplaintResolved(userId, data = {}) {
  return sendNotification({ userId, eventName: 'complaint.resolved', data });
}

module.exports = {
  sendNotification,
  sendComplaintAccepted,
  sendWorkerAssigned,
  sendStatusUpdated,
  sendComplaintResolved,
};
