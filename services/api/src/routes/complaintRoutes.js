const express = require('express');
const complaintController = require('../controllers/complaintController');
const { authRequired } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validation');
const { createComplaintSchema, uploadSchema, updateStatusSchema, complaintIdSchema } = require('../validators/complaintValidator');

const router = express.Router();

router.post('/', authRequired, validate(createComplaintSchema), complaintController.createComplaint);
router.get('/', authRequired, authorize(['issue:read']), complaintController.listComplaints);
router.get('/:id', authRequired, authorize(['issue:read']), validate(complaintIdSchema), complaintController.getComplaint);
router.patch('/:id/status', authRequired, authorize(['issue:status']), validate(updateStatusSchema), complaintController.updateStatus);
router.post('/:id/images', authRequired, authorize(['issue:comment']), validate(uploadSchema), complaintController.uploadImage);

module.exports = router;
