const express = require('express');
const workerController = require('../controllers/workerController');
const { authRequired } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validation');
const { assignComplaintSchema, updateStatusSchema, resolutionProofSchema } = require('../validators/workerValidator');

const router = express.Router();

router.post('/:id/assign', authRequired, authorize(['issue:assign']), validate(assignComplaintSchema), workerController.assignComplaint);
router.patch('/:id/status', authRequired, authorize(['issue:status']), validate(updateStatusSchema), workerController.updateStatus);
router.post('/:id/proof', authRequired, authorize(['issue:status']), validate(resolutionProofSchema), workerController.uploadResolutionProof);
router.get('/tasks', authRequired, authorize(['issue:read']), workerController.listAssignedTasks);

module.exports = router;
