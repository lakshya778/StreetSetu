const workerService = require('../services/workerService');
const { responseFormatter } = require('../utils/responseFormatter');

async function assignComplaint(req, res, next) {
  try {
    const complaint = await workerService.assignComplaint(req.params.id, req.body.assigneeUserId, req.user?.id);
    return responseFormatter(res, 200, complaint, 'Complaint assigned successfully');
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const complaint = await workerService.updateStatus(req.params.id, req.body.status, req.user?.id);
    return responseFormatter(res, 200, complaint, 'Complaint status updated');
  } catch (error) {
    return next(error);
  }
}

async function uploadResolutionProof(req, res, next) {
  try {
    const complaint = await workerService.uploadResolutionProof(req.params.id, req.body.proofUrl);
    return responseFormatter(res, 200, complaint, 'Resolution proof uploaded');
  } catch (error) {
    return next(error);
  }
}

async function listAssignedTasks(req, res, next) {
  try {
    const tasks = await workerService.listAssignedTasks(req.user?.id);
    return responseFormatter(res, 200, tasks, 'Assigned tasks retrieved successfully');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  assignComplaint,
  updateStatus,
  uploadResolutionProof,
  listAssignedTasks,
};
