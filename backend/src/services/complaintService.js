import mongoose from 'mongoose';
import Complaint, {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES
} from '../models/Complaint.js';
import Assignment from '../models/Assignment.js';
import Vote from '../models/Vote.js';
import DuplicateSupport from '../models/DuplicateSupport.js';
import Feedback from '../models/Feedback.js';
import { DUPLICATE_CONFIDENCE_THRESHOLD, findDuplicateCandidates } from './duplicateDetectionService.js';
import { emitToRole, emitToUser, publishComplaintUpdate } from './realtimeService.js';
import { recordAudit } from './auditService.js';
import { requireVerifiedCompletion } from './completionVerificationService.js';
import {
  notifyComplaintRejected,
  notifyComplaintImagesUploaded,
  notifyComplaintResolved,
  notifyComplaintStatusChange,
  notifyComplaintSubmitted
} from './notificationService.js';

const ADMIN_STATUS_TRANSITIONS = {
  submitted: ['under_review', 'rejected'],
  under_review: ['rejected'],
  assigned: ['in_progress'],
  in_progress: ['resolved'],
  resolved: ['closed'],
  closed: [],
  rejected: []
};

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
  const candidates = await findDuplicateCandidates(payload, { limit: 1 });
  const bestCandidate = candidates[0];
  if (bestCandidate && bestCandidate.confidence >= DUPLICATE_CONFIDENCE_THRESHOLD * 100 && !payload.allowDuplicate) {
    const error = new ComplaintError('A similar complaint already exists nearby.', 409, 'DUPLICATE_DETECTED', {
      candidate: { ...bestCandidate.complaint, distanceMeters: bestCandidate.distanceMeters, similarityScore: bestCandidate.confidence }
    });
    throw error;
  }
  const duplicateOf = bestCandidate && bestCandidate.confidence >= DUPLICATE_CONFIDENCE_THRESHOLD * 100 ? bestCandidate.complaint._id : undefined;
  const complaint = await Complaint.create({
    ...payload,
    allowDuplicate: undefined,
    createdBy: creator,
    isDuplicate: Boolean(duplicateOf),
    masterComplaint: duplicateOf,
    duplicateOf,
    duplicateScore: duplicateOf ? bestCandidate.confidence : 0,
    statusHistory: [{ eventType: 'created', status: 'submitted', changedBy: creator, note: 'Complaint created' }]
  });
  const result = await Complaint.findById(complaint._id).populate('createdBy', 'name email role');
  result.voteCount = 0;
  result.supporterCount = 0;
  await recordAudit({ req, actorId: creator, action: 'complaint.created', entityType: 'complaint', entityId: complaint._id, newValue: 'submitted', metadata: { category: complaint.category } });
  try {
    await notifyComplaintSubmitted({ complaint: result });
  } catch (error) {
    console.error('Complaint submission notification failed:', error.message);
  }
  if (result.attachments?.length) {
    try {
      await notifyComplaintImagesUploaded({ complaint: result, uploaderId: creator, count: result.attachments.length });
    } catch (error) {
      console.error('Complaint image notification failed:', error.message);
    }
  }
  publishComplaintUpdate(result, 'complaint:created');
  return result;
}

export async function getComplaint(id, req) {
  const complaint = await Complaint.findById(objectId(id, 'complaint id'))
    .populate('createdBy', 'name email role')
    .populate('assignedTo', 'name email role')
    .populate('assignedVolunteer', 'name email role')
    .populate('rejectedBy', 'name email role')
    .populate('statusHistory.changedBy', 'name email role');
  ensureAccess(req, complaint);
  const result = complaint.toObject();
  result.voteCount = await Vote.countDocuments({ complaint: complaint._id });
  result.supporterCount = result.voteCount;
  if (req.user.role === 'citizen') {
    result.myFeedback = await Feedback.findOne({ complaint: complaint._id, citizen: req.user.sub })
      .select('rating comment createdAt updatedAt').lean();
  }
  return result;
}

export async function submitComplaintFeedback(id, { rating, comment }, req) {
  if (req.user.role !== 'citizen') throw new ComplaintError('Only the reporting citizen can submit feedback', 403, 'FORBIDDEN');
  const complaint = await Complaint.findById(objectId(id, 'complaint id'));
  ensureAccess(req, complaint);
  if (String(complaint.createdBy) !== String(req.user.sub)) {
    throw new ComplaintError('Only the reporting citizen can submit feedback', 403, 'FORBIDDEN');
  }
  if (!['resolved', 'closed'].includes(complaint.status)) {
    throw new ComplaintError('Feedback is available after the complaint is resolved', 409, 'COMPLAINT_NOT_RESOLVED');
  }
  const volunteer = complaint.assignedVolunteer || complaint.assignedTo;
  if (!volunteer) throw new ComplaintError('This complaint has no assigned volunteer to rate', 409, 'VOLUNTEER_NOT_ASSIGNED');
  try {
    const feedback = await Feedback.create({ complaint: complaint._id, citizen: req.user.sub, volunteer, rating, comment });
    await recordAudit({ req, action: 'complaint.feedback_submitted', entityType: 'complaint', entityId: complaint._id, metadata: { rating, volunteerId: String(volunteer) } });
    const update = { complaintId: String(complaint._id), eventType: 'feedback:received' };
    emitToRole('admin', 'dashboard:updated', update);
    emitToUser(volunteer, 'feedback:received', update);
    return { _id: feedback._id, complaint: feedback.complaint, volunteer: feedback.volunteer, rating: feedback.rating, comment: feedback.comment, createdAt: feedback.createdAt };
  } catch (error) {
    if (error?.code === 11000) throw new ComplaintError('Feedback has already been submitted for this complaint', 409, 'FEEDBACK_ALREADY_EXISTS');
    throw error;
  }
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
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$and = [...(filter.$and || []), { $or: [
      { title: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      { address: { $regex: escaped, $options: 'i' } }
    ] }];
  }
  if (query.fromDate || query.toDate) {
    filter.createdAt = {};
    if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
    if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
  }

  const [items, total] = await Promise.all([
    Complaint.find(filter)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('assignedVolunteer', 'name email role')
      .populate('rejectedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Complaint.countDocuments(filter)
  ]);

  const voteCounts = await Vote.aggregate([
    { $match: { complaint: { $in: items.map((item) => item._id) } } },
    { $group: { _id: '$complaint', count: { $sum: 1 } } }
  ]);
  const countsByComplaint = new Map(voteCounts.map((item) => [String(item._id), item.count]));
  items.forEach((item) => { item.voteCount = countsByComplaint.get(String(item._id)) || 0; item.supporterCount = item.voteCount; });

  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function verifyComplaint(id, req) {
  const complaint = await Complaint.findById(objectId(id, 'complaint id'));
  ensureAccess(req, complaint);
  if (String(complaint.createdBy) !== String(req.user.sub)) throw new ComplaintError('Only the complaint creator can verify resolution', 403, 'FORBIDDEN');
  if (complaint.status !== 'resolved') throw new ComplaintError('Only resolved complaints can be verified', 409, 'INVALID_STATUS');
  complaint.status = 'closed';
  complaint.verifiedByCitizen = true;
  complaint.verifiedAt = new Date();
  complaint.statusHistory.push({
    eventType: 'status_changed',
    previousStatus: 'resolved',
    status: 'closed',
    changedBy: userId(req),
    note: 'Resolution verified by citizen'
  });
  await complaint.save();
  await recordAudit({ req, action: 'complaint.status_changed', entityType: 'complaint', entityId: complaint._id, previousValue: 'resolved', newValue: 'closed', metadata: { note: 'Resolution verified by citizen' } });
  publishComplaintUpdate(complaint, 'complaint:status');
  try {
    await notifyComplaintStatusChange({
      complaint,
      previousStatus: 'resolved',
      status: 'closed',
      note: 'Resolution verified by citizen'
    });
  } catch (error) {
    console.error('Complaint verification notification failed:', error.message);
  }
  return complaint;
}

export async function checkComplaintDuplicates(payload) {
  const candidates = await findDuplicateCandidates(payload);
  return candidates.filter((candidate) => candidate.confidence >= DUPLICATE_CONFIDENCE_THRESHOLD * 100)
    .map(({ complaint, ...score }) => ({
      _id: complaint._id,
      title: complaint.title,
      status: complaint.status,
      category: complaint.category,
      address: complaint.address,
      supporterCount: complaint.supporterCount || 0,
      ...score
    }));
}

export async function listDuplicateComplaints() {
  const complaints = await Complaint.find({ $or: [{ duplicateOf: { $exists: true, $ne: null } }, { masterComplaint: { $exists: true, $ne: null } }, { isDuplicate: true }] })
    .populate('duplicateOf', 'title status')
    .populate('masterComplaint', 'title status')
    .populate('mergedBy', 'name')
    .sort({ createdAt: -1 }).limit(500).lean();
  const supportTargets = complaints.map((item) => item.duplicateOf?._id || item.masterComplaint?._id || item._id);
  const counts = await Vote.aggregate([
    { $match: { complaint: { $in: supportTargets } } },
    { $group: { _id: '$complaint', count: { $sum: 1 } } }
  ]);
  const countByComplaint = new Map(counts.map((item) => [String(item._id), item.count]));
  return complaints.map((complaint) => {
    const supportTarget = complaint.duplicateOf?._id || complaint.masterComplaint?._id || complaint._id;
    return { ...complaint, supporterCount: countByComplaint.get(String(supportTarget)) || 0 };
  });
}

export async function mergeDuplicateComplaint(id, masterId, req) {
  const duplicateId = objectId(id, 'complaint id');
  const canonicalId = objectId(masterId, 'master complaint id');
  if (String(duplicateId) === String(canonicalId)) throw new ComplaintError('A complaint cannot be merged into itself', 400, 'VALIDATION_ERROR');
  const [duplicate, master] = await Promise.all([Complaint.findById(duplicateId), Complaint.findById(canonicalId)]);
  if (!duplicate || !master) throw new ComplaintError('Complaint not found', 404, 'NOT_FOUND');
  duplicate.duplicateOf = master._id;
  duplicate.masterComplaint = master._id;
  duplicate.isDuplicate = true;
  duplicate.mergedAt = new Date();
  duplicate.mergedBy = userId(req);
  await duplicate.save();
  await recordAudit({ req, actorId: userId(req), action: 'complaint.duplicate_merged', entityType: 'complaint', entityId: duplicate._id, metadata: { duplicateOf: master._id } });
  return duplicate;
}

export async function voteForComplaint(id, req) {
  const complaint = await Complaint.findById(objectId(id, 'complaint id'));
  if (!complaint) throw new ComplaintError('Complaint not found', 404, 'NOT_FOUND');
  try { await Vote.create({ complaint: complaint._id, user: userId(req) }); }
  catch (error) { if (error.code === 11000) throw new ComplaintError('You have already voted for this complaint', 409, 'CONFLICT'); throw error; }
  await recordAudit({ req, action: 'complaint.vote_added', entityType: 'complaint', entityId: complaint._id });
  const voteCount = await Vote.countDocuments({ complaint: complaint._id });
  await Complaint.updateOne({ _id: complaint._id }, { $set: { supporterCount: voteCount } });
  return { complaint: complaint._id, voteCount, supporterCount: voteCount };
}

export async function supportDuplicate(id, req) {
  const complaint = await Complaint.findById(objectId(id, 'complaint id'));
  if (!complaint) throw new ComplaintError('Complaint not found', 404, 'NOT_FOUND');
  const supporter = userId(req);
  try { await Vote.create({ complaint: complaint._id, user: supporter }); }
  catch (error) { if (error.code !== 11000) throw error; }
  try { await DuplicateSupport.create({ complaint: complaint._id, user: supporter, category: complaint.category }); }
  catch (error) { if (error.code !== 11000) throw error; }
  const supporterCount = await Vote.countDocuments({ complaint: complaint._id });
  await Complaint.updateOne({ _id: complaint._id }, { $set: { supporterCount } });
  await recordAudit({ req, actorId: supporter, action: 'complaint.duplicate_supported', entityType: 'complaint', entityId: complaint._id });
  return { complaint: complaint._id, supporterCount };
}

export async function removeVote(id, req) {
  const complaintId = objectId(id, 'complaint id');
  const result = await Vote.findOneAndDelete({ complaint: complaintId, user: userId(req) });
  if (!result) throw new ComplaintError('Vote not found', 404, 'NOT_FOUND');
  await recordAudit({ req, action: 'complaint.vote_removed', entityType: 'complaint', entityId: complaintId });
  const voteCount = await Vote.countDocuments({ complaint: complaintId });
  await Complaint.updateOne({ _id: complaintId }, { $set: { supporterCount: voteCount } });
  return { complaint: complaintId, voteCount, supporterCount: voteCount };
}

export async function listMapComplaints(query = {}, req) {
  const hasPagination = query.page !== undefined || query.limit !== undefined;
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 5000, 1), 5000);
  const filter = { latitude: { $exists: true }, longitude: { $exists: true } };
  if (req?.user?.role !== 'admin') filter.$and = [...(filter.$and || []), { $or: [{ createdBy: req.user.sub }, { assignedTo: req.user.sub }, { assignedVolunteer: req.user.sub }] }];
  if (query.status && COMPLAINT_STATUSES.includes(query.status)) filter.status = query.status;
  if (query.category && COMPLAINT_CATEGORIES.includes(query.category)) filter.category = query.category;
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$and = [...(filter.$and || []), { $or: [{ title: { $regex: escaped, $options: 'i' } }, { address: { $regex: escaped, $options: 'i' } }] }];
  }
  const [items, total] = await Promise.all([
    Complaint.find(filter).select('_id title category status latitude longitude address attachments beforeImages afterImages isDuplicate duplicateOf masterComplaint duplicateScore')
      .sort({ createdAt: -1 }).skip(hasPagination ? (page - 1) * limit : 0).limit(limit).lean(),
    hasPagination ? Complaint.countDocuments(filter) : Promise.resolve(null)
  ]);
  return hasPagination ? { items, page, limit, total, pages: Math.ceil(total / limit) || 1 } : items;
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

  if (status === 'rejected' && req.user.role !== 'admin') {
    throw new ComplaintError('Only admins can reject complaints', 403, 'FORBIDDEN');
  }

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

  if (!COMPLAINT_STATUSES.includes(status)) {
    throw new ComplaintError('Invalid complaint status', 400, 'VALIDATION_ERROR');
  }

  const previousStatus = complaint.status;

  if (previousStatus === status) {
    throw new ComplaintError(
      'Complaint already has this status',
      409,
      'CONFLICT'
    );
  }

  const allowedTransitions = req.user.role === 'volunteer'
    ? (previousStatus === 'assigned' ? ['in_progress'] : previousStatus === 'in_progress' ? ['resolved'] : [])
    : ADMIN_STATUS_TRANSITIONS[previousStatus] || [];
  if (!allowedTransitions.includes(status)) {
    throw new ComplaintError(
      `Complaint cannot move from ${previousStatus} to ${status}`,
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  if (req.user.role === 'volunteer' && status === 'in_progress' && complaint.beforeImages.length === 0) {
    throw new ComplaintError('Upload at least one work-start image before starting this complaint', 409, 'WORK_EVIDENCE_REQUIRED');
  }
  if (req.user.role === 'volunteer' && status === 'resolved' && complaint.afterImages.length === 0) {
    throw new ComplaintError('Upload at least one completion image before resolving this complaint', 409, 'WORK_EVIDENCE_REQUIRED');
  }
  if (req.user.role === 'volunteer' && status === 'resolved') await requireVerifiedCompletion(complaint);

  const changedAt = new Date();
  complaint.status = status;
  if (status === 'resolved') complaint.resolvedAt = changedAt;
  if (status === 'rejected') {
    complaint.rejectedAt = changedAt;
    complaint.rejectedBy = userId(req);
    complaint.rejectionReason = note.trim();
  }

  complaint.statusHistory.push({
    eventType: 'status_changed',
    previousStatus,
    status,
    changedBy: userId(req),
    assignedVolunteer:
      assignment?.volunteer || complaint.assignedVolunteer,
    note,
    changedAt
  });

  await complaint.save();
  await recordAudit({ req, action: `complaint.${status}`, entityType: 'complaint', entityId: complaint._id, previousValue: previousStatus, newValue: status, metadata: { note, rejectionReason: status === 'rejected' ? note : undefined } });
  publishComplaintUpdate(complaint, status === 'rejected' ? 'complaint:rejected' : 'complaint:status');

  try {
    if (status === 'rejected') {
      await notifyComplaintRejected({ complaint, previousStatus, reason: note });
    } else if (status === 'resolved') {
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
