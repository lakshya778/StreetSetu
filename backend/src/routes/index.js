import { Router } from 'express';
import authRoutes from './authRoutes.js';
import complaintRoutes from './complaintRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import geoRoutes from './geoRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import aiRoutes from './aiRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import userRoutes from './userRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import publicRoutes from './publicRoutes.js';
import adminRoutes from './adminRoutes.js';
import driveRoutes from './driveRoutes.js';
import leaderboardRoutes from './leaderboardRoutes.js';
import gamificationRoutes from './gamificationRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'StreetSetu API is healthy' });
});

router.use('/public', publicRoutes);
router.use('/admin', adminRoutes);
router.use('/drives', driveRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/gamification', gamificationRoutes);

router.use('/auth', authRoutes);
router.use('/complaints', complaintRoutes);
router.use('/uploads', uploadRoutes);
router.use('/geo', geoRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ai', aiRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/users', userRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
