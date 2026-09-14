const Joi = require('joi');

const sendNotificationSchema = Joi.object({
  userId: Joi.string().required(),
  eventName: Joi.string().valid(
    'complaint.accepted',
    'worker.assigned',
    'complaint.status.updated',
    'complaint.resolved'
  ).required(),
  pushToken: Joi.string().optional(),
  data: Joi.object().optional(),
});

module.exports = {
  sendNotificationSchema,
};
