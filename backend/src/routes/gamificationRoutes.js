import { Router } from 'express';
import { latestMonthlyTopThree } from '../controllers/gamificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/top3', authenticate, latestMonthlyTopThree);

export default router;
