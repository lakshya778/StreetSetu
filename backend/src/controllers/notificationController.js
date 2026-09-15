import { listNotifications, markNotificationRead } from '../services/notificationService.js';

export async function list(req, res, next) {
  try {
    return res.json({ success: true, data: await listNotifications(req.notificationQuery, req) });
  } catch (error) {
    return next(error);
  }
}

export async function markRead(req, res, next) {
  try {
    return res.json({ success: true, data: await markNotificationRead(req.params.id, req), message: 'Notification marked as read' });
  } catch (error) {
    return next(error);
  }
}