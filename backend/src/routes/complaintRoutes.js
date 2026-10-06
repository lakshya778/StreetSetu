import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { categories, create, detail, duplicateCheck, duplicates, list, map, mergeDuplicate, submitFeedback, supportDuplicateComplaint, unvote, updateStatus, verify, vote } from '../controllers/complaintController.js';
import { discoverNearby } from '../controllers/geoController.js';
import {
	validateCreateComplaint,
	validateListComplaints,
	validateStatusUpdate
} from '../validators/complaintValidator.js';
import { validateNearbyComplaints } from '../validators/geoValidator.js';
import { validateFeedback } from '../validators/feedbackValidator.js';

const router = Router();

router.use(authenticate);
router.get('/categories', categories);
router.get('/map', authorize('citizen', 'volunteer', 'admin'), validateListComplaints, map);
router.get('/nearby', authorize('citizen', 'volunteer', 'admin'), validateNearbyComplaints, discoverNearby);
router.post('/duplicates/check', authorize('citizen', 'volunteer', 'admin'), validateCreateComplaint, duplicateCheck);
router.get('/duplicates', authorize('admin'), duplicates);
router.post('/', authorize('citizen', 'volunteer', 'admin'), validateCreateComplaint, create);
router.get('/', authorize('citizen', 'volunteer', 'admin'), validateListComplaints, list);
router.get('/:id', authorize('citizen', 'volunteer', 'admin'), detail);
router.post('/:id/feedback', authorize('citizen'), validateFeedback, submitFeedback);
router.patch('/:id/status', authorize('volunteer', 'admin'), validateStatusUpdate, updateStatus);
router.post('/:id/verify', authorize('citizen'), verify);
router.post('/:id/vote', authorize('citizen', 'volunteer', 'admin'), vote);
router.post('/:id/support-duplicate', authorize('citizen', 'volunteer', 'admin'), supportDuplicateComplaint);
router.post('/:id/merge', authorize('admin'), mergeDuplicate);
router.delete('/:id/vote', authorize('citizen', 'volunteer', 'admin'), unvote);

export default router;
