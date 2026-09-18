import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { categories, create, detail, list, map, unvote, updateStatus, verify, vote } from '../controllers/complaintController.js';
import {
	validateCreateComplaint,
	validateListComplaints,
	validateStatusUpdate
} from '../validators/complaintValidator.js';

const router = Router();

router.use(authenticate);
router.get('/categories', categories);
router.get('/map', authorize('citizen', 'volunteer', 'admin'), map);
router.post('/', authorize('citizen', 'volunteer', 'admin'), validateCreateComplaint, create);
router.get('/', authorize('citizen', 'volunteer', 'admin'), validateListComplaints, list);
router.get('/:id', authorize('citizen', 'volunteer', 'admin'), detail);
router.patch('/:id/status', authorize('volunteer', 'admin'), validateStatusUpdate, updateStatus);
router.post('/:id/verify', authorize('citizen'), verify);
router.post('/:id/vote', authorize('citizen', 'volunteer', 'admin'), vote);
router.delete('/:id/vote', authorize('citizen', 'volunteer', 'admin'), unvote);

export default router;
