import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { assign, myAssignments, reassign, updateStatus } from '../controllers/assignmentController.js';
import { validateAssignment, validateReassignment, validateWorkflowStatus } from '../validators/assignmentValidator.js';

const router = Router();

router.use(authenticate);
router.post('/:complaintId/assign', authorize('admin'), validateAssignment, assign);
router.put('/:complaintId/reassign', authorize('admin'), validateReassignment, reassign);
router.get('/my-assignments', authorize('volunteer'), myAssignments);
router.patch('/:complaintId/status', authorize('volunteer'), validateWorkflowStatus, updateStatus);

export default router;
