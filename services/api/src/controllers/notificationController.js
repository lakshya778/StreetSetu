const notificationService = require('../services/notificationService');
const { responseFormatter } = require('../utils/responseFormatter');

async function send(req, res, next) {
  try {
    const result = await notificationService.sendNotification({
      userId: req.body.userId,
      eventName: req.body.eventName,
      data: req.body.data || {},
      pushToken: req.body.pushToken,
    });

    return responseFormatter(res, 201, result, 'Notification queued');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  send,
};
