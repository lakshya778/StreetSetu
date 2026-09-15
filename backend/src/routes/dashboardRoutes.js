import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { summary } from '../controllers/dashboardController.js';
import { validateDashboardQuery } from '../validators/dashboardValidator.js';

const router = Router();

router.use(authenticate);
router.get('/summary', authorize('citizen', 'volunteer', 'admin'), validateDashboardQuery, summary);

export default router;
