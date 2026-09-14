const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authRequired } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { sendNotificationSchema } = require('../validators/notificationValidator');

const router = express.Router();

router.post('/send', authRequired, validate(sendNotificationSchema), notificationController.send);

module.exports = router;
