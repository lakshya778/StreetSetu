import mongoose from 'mongoose';
import Assignment from '../models/Assignment.js';
import Complaint, { VOLUNTEER_WORKFLOW_STATUSES } from '../models/Complaint.js';
import User from '../models/User.js';
import { notifyVolunteerAssigned } from './notificationService.js';

export class AssignmentError extends Error {
  constructor(message, statusCode = 400, code = 'ASSIGNMENT_ERROR') {
    super(message);
    this.name = 'AssignmentError';
    this.statusCode = statusCode;
    this.code = code;
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
  const current = await Assignment.findOne({ complaint: complaint._id, isActive: true });
  if (current) {
    current.isActive = false;
    current.endedAt = new Date();
    current.endReason = eventType === 'reassigned' ? 'Reassigned by admin' : 'Assignment replaced';
    await current.save();
  }

  const assignment = await Assignment.create({
    complaint: complaint._id,
    volunteer: volunteer._id,
    assignedBy: new mongoose.Types.ObjectId(req.user.sub)
  });
  const previousStatus = complaint.status;
  complaint.assignedVolunteer = volunteer._id;
  complaint.assignedTo = volunteer._id;
  complaint.status = 'assigned';
  complaint.statusHistory.push({
    eventType,
    status: 'assigned',
    changedBy: new mongoose.Types.ObjectId(req.user.sub),
    assignedVolunteer: volunteer._id,
    note
  });
  await complaint.save();

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

export async function assignComplaint(complaintId, volunteerId, req) {
  requireAdmin(req);
  const complaint = await getComplaint(complaintId);
  const existing = await Assignment.findOne({ complaint: complaint._id, isActive: true });
  if (existing) throw new AssignmentError('Complaint already has an active volunteer assignment', 409, 'ACTIVE_ASSIGNMENT_EXISTS');
  const volunteer = await getVolunteer(volunteerId);
  return writeAssignment(complaint, volunteer, req, 'assigned', 'Complaint assigned by admin');
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
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function updateAssignedStatus(complaintId, { status, note }, req) {
  if (req.user.role !== 'volunteer') throw new AssignmentError('Only volunteers can update assigned complaint status', 403, 'FORBIDDEN');
  if (!VOLUNTEER_WORKFLOW_STATUSES.includes(status)) throw new AssignmentError('Invalid volunteer workflow status', 400, 'VALIDATION_ERROR');
  const complaint = await getComplaint(complaintId);
  const assignment = await Assignment.findOne({ complaint: complaint._id, volunteer: objectId(req.user.sub, 'user id'), isActive: true });
  if (!assignment) throw new AssignmentError('Only the assigned volunteer can update this complaint', 403, 'FORBIDDEN');
  if (complaint.status === status) throw new AssignmentError('Complaint already has this status', 409, 'CONFLICT');

  const previousStatus = complaint.status;
  complaint.status = statusFromWorkflow(status);
  complaint.statusHistory.push({
    eventType: 'status_changed',
    status,
    changedBy: objectId(req.user.sub, 'user id'),
    assignedVolunteer: assignment.volunteer,
    note
  });
  await complaint.save();
  try {
    await notifyComplaintStatusChange({ complaint, previousStatus, status, note });
  } catch (error) {
    console.error('Workflow notification failed:', error.message);
  }
  return complaint;
}
