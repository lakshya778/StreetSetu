import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { categories, create, detail, list, updateStatus } from '../controllers/complaintController.js';
import {
	validateCreateComplaint,
	validateListComplaints,
	validateStatusUpdate
} from '../validators/complaintValidator.js';

const router = Router();

router.use(authenticate);
router.get('/categories', categories);
router.post('/', authorize('citizen', 'volunteer', 'admin'), validateCreateComplaint, create);
router.get('/', authorize('citizen', 'volunteer', 'admin'), validateListComplaints, list);
router.get('/:id', authorize('citizen', 'volunteer', 'admin'), detail);
router.patch('/:id/status', authorize('volunteer', 'admin'), validateStatusUpdate, updateStatus);

export default router;
