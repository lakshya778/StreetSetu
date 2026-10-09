import { Router } from 'express';
import { leaderboard } from '../controllers/gamificationController.js';
import { authenticate } from '../middleware/auth.js';
import { validateLeaderboardQuery } from '../validators/gamificationValidator.js';

const router = Router();

router.get('/', authenticate, validateLeaderboardQuery, leaderboard);

export default router;
