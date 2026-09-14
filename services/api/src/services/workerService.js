const Complaint = require('../models/Complaint');
const User = require('../models/User');

async function assignComplaint(complaintId, assigneeUserId, actorUserId) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const assignee = await User.findById(assigneeUserId);
  if (!assignee) {
    const error = new Error('Assignee user not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  complaint.assignedToUserId = assigneeUserId;
  complaint.status = 'assigned';
  complaint.updatedBy = actorUserId || assigneeUserId;
  complaint.updatedAt = new Date();
  await complaint.save();

  return complaint;
}

async function updateStatus(complaintId, status, actorUserId) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!['submitted', 'reviewed', 'assigned', 'in_progress', 'resolved', 'rejected', 'escalated'].includes(status)) {
    const error = new Error('Invalid complaint status');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  complaint.status = status;
  complaint.updatedBy = actorUserId || complaint.updatedBy;
  complaint.updatedAt = new Date();
  await complaint.save();

  return complaint;
}

async function uploadResolutionProof(complaintId, proofUrl) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!proofUrl) {
    const error = new Error('Resolution proof URL is required');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  complaint.imageUrls = [...new Set([...(complaint.imageUrls || []), proofUrl])];
  complaint.status = 'resolved';
  complaint.resolvedAt = new Date();
  complaint.updatedAt = new Date();
  await complaint.save();

  return complaint;
}

async function listAssignedTasks(userId) {
  const complaints = await Complaint.find({ assignedToUserId: userId }).sort({ updatedAt: -1 });
  return complaints;
}

module.exports = {
  assignComplaint,
  updateStatus,
  uploadResolutionProof,
  listAssignedTasks,
};
