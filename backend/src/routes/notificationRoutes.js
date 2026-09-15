import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { list, markRead } from '../controllers/notificationController.js';
import { validateNotificationList } from '../validators/notificationValidator.js';

const router = Router();

router.use(authenticate);
router.get('/', validateNotificationList, list);
router.patch('/:id/read', markRead);

export default router;