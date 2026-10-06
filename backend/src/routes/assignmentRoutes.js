import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { assign, completionVerification, completionVerifications, myAssignments, myRoute, recommendTop, recommendations, reassign, respond, reviewCompletion, updateStatus } from '../controllers/assignmentController.js';
import { validateAssignment, validateAssignmentResponse, validateReassignment, validateWorkflowStatus } from '../validators/assignmentValidator.js';

const router = Router();

router.use(authenticate);
router.get('/completion-verifications', authorize('admin'), completionVerifications);
router.get('/completion-verifications/:complaintId', authorize('admin', 'volunteer'), completionVerification);
router.patch('/completion-verifications/:complaintId', authorize('admin'), reviewCompletion);
router.post('/:complaintId/assign', authorize('admin'), validateAssignment, assign);
router.get('/recommend/:complaintId', authorize('admin'), recommendTop);
router.get('/my-route', authorize('volunteer'), myRoute);
router.patch('/:complaintId/response', authorize('volunteer'), validateAssignmentResponse, respond);
router.get('/:complaintId/recommendations', authorize('admin'), recommendations);
router.put('/:complaintId/reassign', authorize('admin'), validateReassignment, reassign);
router.get('/my-assignments', authorize('volunteer'), myAssignments);
router.patch('/:complaintId/status', authorize('volunteer'), validateWorkflowStatus, updateStatus);

export default router;
