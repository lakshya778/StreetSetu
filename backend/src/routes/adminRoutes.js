import { Router } from 'express';
import { runEscalation } from '../controllers/adminEscalationController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();
router.use(authenticate, authorize('admin'));
router.post('/escalation/run', runEscalation);

export default router;
