import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { nearbyComplaints } from '../controllers/geoController.js';
import { validateNearbyComplaints } from '../validators/geoValidator.js';

const router = Router();

router.use(authenticate);
router.get(
  '/complaints/nearby',
  authorize('citizen', 'volunteer', 'admin'),
  validateNearbyComplaints,
  nearbyComplaints
);

export default router;