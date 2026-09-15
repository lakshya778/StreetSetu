import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { classify } from '../controllers/aiController.js';
import { validateComplaintClassification } from '../validators/aiValidator.js';

const router = Router();

router.use(authenticate);
router.post(
  '/complaints/:id/classify',
  authorize('citizen', 'volunteer', 'admin'),
  validateComplaintClassification,
  classify
);

export default router;