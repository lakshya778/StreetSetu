import mongoose from 'mongoose';
import Complaint, {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  VOLUNTEER_WORKFLOW_STATUSES
} from '../models/Complaint.js';
import Assignment from '../models/Assignment.js';
import { notifyComplaintResolved, notifyComplaintStatusChange, notifyComplaintSubmitted } from './notificationService.js';

export class ComplaintError extends Error {
  constructor(message, statusCode = 400, code = 'COMPLAINT_ERROR', details) {
    super(message);
    this.name = 'ComplaintError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function objectId(value, field = 'id') {
  if (!mongoose.isValidObjectId(value)) {
    throw new ComplaintError(`Invalid ${field}`, 400, 'VALIDATION_ERROR');
  }
  return new mongoose.Types.ObjectId(value);
}

function userId(req) {
  return objectId(req.user.sub, 'user id');
}

function canManageAll(req) {
  return req.user.role === 'admin';
}

function canAccessComplaint(req, complaint) {
  return canManageAll(req) || String(complaint.createdBy?._id || complaint.createdBy) === String(req.user.sub)
    || String(complaint.assignedVolunteer?._id || complaint.assignedVolunteer || complaint.assignedTo?._id || complaint.assignedTo) === String(req.user.sub);
}

function ensureAccess(req, complaint) {
  if (!complaint) throw new ComplaintError('Complaint not found', 404, 'NOT_FOUND');
  if (!canAccessComplaint(req, complaint)) {
    throw new ComplaintError('You do not have access to this complaint', 403, 'FORBIDDEN');
  }
}

export async function createComplaint(payload, req) {
  const creator = userId(req);
  const complaint = await Complaint.create({
    ...payload,
    createdBy: creator,
    statusHistory: [{ eventType: 'created', status: 'submitted', changedBy: creator, note: 'Complaint created' }]
  });
  const result = await Complaint.findById(complaint._id).populate('createdBy', 'name email role');
  try {
    await notifyComplaintSubmitted({ complaint: result });
  } catch (error) {
    console.error('Complaint submission notification failed:', error.message);
  }
  return result;
}

export async function getComplaint(id, req) {
  const complaint = await Complaint.findById(objectId(id, 'complaint id'))
    .populate('createdBy', 'name email role')
    .populate('assignedTo', 'name email role')
    .populate('assignedVolunteer', 'name email role')
    .populate('statusHistory.changedBy', 'name email role');
  ensureAccess(req, complaint);
  return complaint;
}

export async function listComplaints(query, req) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  const filter = {};

  if (!canManageAll(req)) {
    filter.$or = [{ createdBy: userId(req) }, { assignedVolunteer: userId(req) }, { assignedTo: userId(req) }];
  }
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.priority) filter.priority = query.priority;
  if (query.assignedTo) filter.assignedTo = objectId(query.assignedTo, 'assignee id');

  const [items, total] = await Promise.all([
    Complaint.find(filter)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('assignedVolunteer', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Complaint.countDocuments(filter)
  ]);

  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function updateComplaintStatus(id, { status, note }, req) {
  if (!['volunteer', 'admin'].includes(req.user.role)) {
    throw new ComplaintError(
      'Only assigned volunteers or admins can update complaint status',
      403,
      'FORBIDDEN'
    );
  }

  const complaint = await Complaint.findById(
    objectId(id, 'complaint id')
  );

  ensureAccess(req, complaint);

  const assignment =
    req.user.role === 'volunteer'
      ? await Assignment.findOne({
          complaint: complaint._id,
          volunteer: userId(req),
          isActive: true
        })
      : null;

  if (req.user.role === 'volunteer' && !assignment) {
    throw new ComplaintError(
      'Volunteers can update only assigned complaints',
      403,
      'FORBIDDEN'
    );
  }

  // Volunteer can only use workflow statuses
  if (req.user.role === 'volunteer') {
    if (!VOLUNTEER_WORKFLOW_STATUSES.includes(status)) {
      throw new ComplaintError(
        'Invalid volunteer workflow status',
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  // Admin can use all complaint statuses
  if (req.user.role === 'admin') {
    if (!COMPLAINT_STATUSES.includes(status)) {
      throw new ComplaintError(
        'Invalid complaint status',
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  const previousStatus = complaint.status;

  if (previousStatus === status) {
    throw new ComplaintError(
      'Complaint already has this status',
      409,
      'CONFLICT'
    );
  }

  complaint.status = status;

  complaint.statusHistory.push({
    eventType: 'status_changed',
    status,
    changedBy: userId(req),
    assignedVolunteer:
      assignment?.volunteer || complaint.assignedVolunteer,
    note
  });

  await complaint.save();

  try {
    if (status === 'resolved') {
      await notifyComplaintResolved({
        complaint,
        previousStatus,
        note
      });
    } else {
      await notifyComplaintStatusChange({
        complaint,
        previousStatus,
        status,
        note
      });
    }
  } catch (error) {
    console.error(
      'Complaint status notification failed:',
      error.message
    );
  }

  return complaint;
}
export function listCategories() {
  return COMPLAINT_CATEGORIES;
}