import mongoose from 'mongoose';
import Assignment from '../models/Assignment.js';
import Complaint, { VOLUNTEER_WORKFLOW_STATUSES } from '../models/Complaint.js';
import User from '../models/User.js';
import { notifyRecommendationAccepted, notifyVolunteerAssigned } from './notificationService.js';
import { emitToRole, publishComplaintUpdate, removeUserFromComplaintRoom } from './realtimeService.js';
import { recordAudit } from './auditService.js';
import { distanceInKm } from './assignmentRecommendationService.js';
import { requireVerifiedCompletion } from './completionVerificationService.js';
import { redactAssignmentReporters, redactComplaintReporter } from './complaintPrivacy.js';

export class AssignmentError extends Error {
  constructor(message, statusCode = 400, code = 'ASSIGNMENT_ERROR', details) {
    super(message);
    this.name = 'AssignmentError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) throw new AssignmentError(`Invalid ${field}`, 400, 'VALIDATION_ERROR');
  return new mongoose.Types.ObjectId(value);
}

function requireAdmin(req) {
  if (req.user.role !== 'admin') throw new AssignmentError('Only admins can assign complaints', 403, 'FORBIDDEN');
}

async function getVolunteer(volunteerId) {
  const volunteer = await User.findOne({ _id: objectId(volunteerId, 'volunteer id'), role: 'volunteer', isActive: true });
  if (!volunteer) throw new AssignmentError('Assignee must be an active volunteer', 422, 'INVALID_VOLUNTEER');
  return volunteer;
}

async function getComplaint(complaintId) {
  const complaint = await Complaint.findById(objectId(complaintId, 'complaint id'));
  if (!complaint) throw new AssignmentError('Complaint not found', 404, 'NOT_FOUND');
  return complaint;
}

function statusFromWorkflow(status) {
  return status;
}

async function writeAssignment(complaint, volunteer, req, eventType, note) {
  const canAssign = eventType === 'reassigned'
    ? ['assigned', 'in_progress'].includes(complaint.status)
    : complaint.status === 'under_review';
  if (!canAssign) {
    throw new AssignmentError(
      'Only complaints under review can be assigned',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }
  const current = await Assignment.findOne({ complaint: complaint._id, isActive: true });
  if (current) {
    current.isActive = false;
    current.endedAt = new Date();
    current.endReason = eventType === 'reassigned' ? 'Reassigned by admin' : 'Assignment replaced';
    await current.save();
    if (eventType === 'reassigned') removeUserFromComplaintRoom(current.volunteer, complaint._id);
  }

  const assignment = await Assignment.create({
    complaint: complaint._id,
    volunteer: volunteer._id,
    assignedBy: new mongoose.Types.ObjectId(req.user.sub),
    distanceKm: distanceInKm(complaint.location?.coordinates, volunteer.location?.coordinates)
  });
  const previousStatus = complaint.status;
  complaint.assignedVolunteer = volunteer._id;
  complaint.assignedTo = volunteer._id;
  complaint.status = eventType === 'reassigned' ? previousStatus : 'assigned';
  complaint.statusHistory.push({
    eventType,
    previousStatus,
    status: complaint.status,
    changedBy: new mongoose.Types.ObjectId(req.user.sub),
    assignedVolunteer: volunteer._id,
    note,
    changedAt: new Date()
  });
  await complaint.save();
  await recordAudit({ req, action: `complaint.${eventType}`, entityType: 'complaint', entityId: complaint._id, previousValue: previousStatus, newValue: complaint.status, metadata: { assignedVolunteer: String(volunteer._id) } });
  publishComplaintUpdate(complaint, eventType === 'reassigned' ? 'complaint:reassigned' : 'complaint:assigned');

  try {
    await notifyVolunteerAssigned({
      complaint,
      volunteerId: volunteer._id,
      reassigned: eventType === 'reassigned'
    });
  } catch (error) {
    console.error('Assignment notification failed:', error.message);
  }
  return assignment;
}

export async function assignComplaint(complaintId, volunteerId, req, { recommendationAccepted = false } = {}) {
  requireAdmin(req);
  const complaint = await getComplaint(complaintId);
  const existing = await Assignment.findOne({ complaint: complaint._id, isActive: true });
  if (existing) throw new AssignmentError('Complaint already has an active volunteer assignment', 409, 'ACTIVE_ASSIGNMENT_EXISTS');
  const volunteer = await getVolunteer(volunteerId);
  const assignment = await writeAssignment(complaint, volunteer, req, 'assigned', 'Complaint assigned by admin');
  if (recommendationAccepted) {
    try {
      await notifyRecommendationAccepted({ complaint, volunteerId: volunteer._id, acceptedBy: req.user.sub });
    } catch (error) {
      console.error('Recommendation acceptance notification failed:', error.message);
    }
  }
  return assignment;
}

export async function reassignComplaint(complaintId, volunteerId, req) {
  requireAdmin(req);
  const complaint = await getComplaint(complaintId);
  const volunteer = await getVolunteer(volunteerId);
  const previous = await Assignment.findOne({ complaint: complaint._id, isActive: true });
  if (previous && String(previous.volunteer) === String(volunteer._id)) {
    throw new AssignmentError('Complaint is already assigned to this volunteer', 409, 'ACTIVE_ASSIGNMENT_EXISTS');
  }
  return writeAssignment(complaint, volunteer, req, 'reassigned', 'Complaint reassigned by admin');
}

export async function listMyAssignments(query, req) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  const filter = { volunteer: objectId(req.user.sub, 'user id'), isActive: true };
  const [items, total] = await Promise.all([
    Assignment.find(filter)
      .populate('complaint')
      .populate('assignedBy', 'name email role')
      .sort({ assignedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Assignment.countDocuments(filter)
  ]);
  return { items: redactAssignmentReporters(items, req), page, limit, total, pages: Math.ceil(total / limit) };
}

export async function respondToAssignment(complaintId, response, req) {
  if (req.user.role !== 'volunteer') throw new AssignmentError('Only volunteers can respond to assignments', 403, 'FORBIDDEN');
  const complaint = await getComplaint(complaintId);
  const assignment = await Assignment.findOne({ complaint: complaint._id, volunteer: objectId(req.user.sub, 'user id'), isActive: true });
  if (!assignment) throw new AssignmentError('Active assignment not found', 404, 'NOT_FOUND');
  if (complaint.status !== 'assigned') throw new AssignmentError('Only newly assigned complaints can be accepted or declined', 409, 'INVALID_STATUS');
  if (assignment.responseStatus !== 'pending') throw new AssignmentError('You have already responded to this assignment', 409, 'ASSIGNMENT_ALREADY_RESPONDED');

  const now = new Date();
  assignment.responseStatus = response;
  assignment.respondedAt = now;
  if (response === 'accepted') assignment.acceptedAt = now;
  if (response === 'declined') {
    assignment.isActive = false;
    assignment.endedAt = now;
    assignment.endReason = 'Declined by volunteer';
    const previousStatus = complaint.status;
    complaint.assignedTo = undefined;
    complaint.assignedVolunteer = undefined;
    complaint.status = 'under_review';
    complaint.statusHistory.push({
      eventType: 'status_changed', previousStatus, status: 'under_review',
      changedBy: objectId(req.user.sub, 'user id'), note: 'Volunteer declined the assignment', changedAt: now
    });
    await complaint.save();
    publishComplaintUpdate(complaint, 'complaint:status');
  }
  await assignment.save();
  await recordAudit({ req, action: `assignment.${response}`, entityType: 'assignment', entityId: assignment._id, newValue: response, metadata: { complaintId: String(complaint._id) } });
  emitToRole('admin', 'dashboard:updated', { complaintId: String(complaint._id), eventType: `assignment.${response}` });
  return assignment;
}

export async function updateAssignedStatus(complaintId, { status, note }, req) {
  if (req.user.role !== 'volunteer') throw new AssignmentError('Only volunteers can update assigned complaint status', 403, 'FORBIDDEN');
  if (!VOLUNTEER_WORKFLOW_STATUSES.includes(status)) throw new AssignmentError('Invalid volunteer workflow status', 400, 'VALIDATION_ERROR');
  const complaint = await getComplaint(complaintId);
  const assignment = await Assignment.findOne({ complaint: complaint._id, volunteer: objectId(req.user.sub, 'user id'), isActive: true });
  if (!assignment) throw new AssignmentError('Only the assigned volunteer can update this complaint', 403, 'FORBIDDEN');
  const workflowState = {
    status: complaint.status,
    verificationStatus: complaint.completionVerification?.verificationStatus || 'not_started'
  };
  console.info('Assignment status transition requested', {
    assignmentId: String(assignment._id),
    complaintId: String(complaint._id),
    currentStatus: complaint.status,
    requestedStatus: status,
    workflowState
  });
  if (complaint.status === status) throw new AssignmentError('Complaint already has this status', 409, 'INVALID_STATUS_TRANSITION', {
    currentStatus: complaint.status, requestedStatus: status, reason: 'The requested status is already current.'
  });

  const previousStatus = complaint.status;
  const allowedNextStatus = previousStatus === 'assigned' ? 'in_progress' : null;
  if (status !== allowedNextStatus) {
    throw new AssignmentError(`Complaint cannot move from ${previousStatus} to ${status}`, 409, 'INVALID_STATUS_TRANSITION', {
      currentStatus: previousStatus,
      requestedStatus: status,
      reason: `Allowed next status: ${allowedNextStatus || 'none'}.`
    });
  }
  if (status === 'in_progress' && complaint.beforeImages.length === 0) {
    throw new AssignmentError('Upload at least one work-start image before starting this complaint', 409, 'WORK_EVIDENCE_REQUIRED');
  }
  if (status === 'resolved' && complaint.afterImages.length === 0) {
    throw new AssignmentError('Upload at least one completion image before resolving this complaint', 409, 'WORK_EVIDENCE_REQUIRED');
  }
  if (status === 'resolved') await requireVerifiedCompletion(complaint);
  if (assignment.responseStatus === 'pending') {
    assignment.responseStatus = 'accepted';
    assignment.acceptedAt = new Date();
    assignment.respondedAt = assignment.acceptedAt;
    await assignment.save();
  }
  complaint.status = statusFromWorkflow(status);
  if (status === 'resolved') complaint.resolvedAt = new Date();
  complaint.statusHistory.push({
    eventType: 'status_changed',
    previousStatus,
    status,
    changedBy: objectId(req.user.sub, 'user id'),
    assignedVolunteer: assignment.volunteer,
    note,
    changedAt: new Date()
  });
  await complaint.save();
  await recordAudit({ req, action: 'complaint.status_changed', entityType: 'complaint', entityId: complaint._id, previousValue: previousStatus, newValue: status, metadata: { note } });
  publishComplaintUpdate(complaint, 'complaint:status');
  try {
    await notifyComplaintStatusChange({ complaint, previousStatus, status, note });
  } catch (error) {
    console.error('Workflow notification failed:', error.message);
  }
  return redactComplaintReporter(complaint, req);
}
