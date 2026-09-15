import { Router } from 'express';
import authRoutes from './authRoutes.js';
import complaintRoutes from './complaintRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import geoRoutes from './geoRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import aiRoutes from './aiRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'StreetSetu API is healthy' });
});

router.use('/auth', authRoutes);
router.use('/complaints', complaintRoutes);
router.use('/uploads', uploadRoutes);
router.use('/geo', geoRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ai', aiRoutes);
router.use('/assignments', assignmentRoutes);

export default router;
