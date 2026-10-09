import { Router } from 'express';
import { runEscalation } from '../controllers/adminEscalationController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { closeGamificationMonth } from '../controllers/gamificationController.js';

const router = Router();
router.use(authenticate, authorize('admin'));
router.post('/escalation/run', runEscalation);
router.post('/gamification/close-month', closeGamificationMonth);

export default router;
