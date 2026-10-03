import { Router } from 'express';
import { trackComplaint, transparency } from '../controllers/publicController.js';

const router = Router();
router.get('/transparency', transparency);
router.get('/complaints/:complaintId', trackComplaint);
export default router;
