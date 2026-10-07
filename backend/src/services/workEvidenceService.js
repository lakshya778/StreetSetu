import mongoose from 'mongoose';
import Assignment from '../models/Assignment.js';
import Complaint from '../models/Complaint.js';
import { notifyComplaintImagesUploaded } from './notificationService.js';
import { deleteImagesFromCloudinary, uploadImagesToCloudinary } from './uploadService.js';
import { recordAudit } from './auditService.js';
import { publishComplaintUpdate } from './realtimeService.js';
import { extractEvidenceMetadata, queueCompletionVerification } from './completionVerificationService.js';

function evidenceError(message, statusCode = 400, code = 'EVIDENCE_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export async function addWorkEvidence({ complaintId, stage, files, req }) {
  if (!mongoose.isValidObjectId(complaintId)) {
    throw evidenceError('Complaint id must be valid', 400, 'VALIDATION_ERROR');
  }
  if (!['before', 'after'].includes(stage)) {
    throw evidenceError('Evidence stage must be before or after', 400, 'VALIDATION_ERROR');
  }
  if (req.user.role !== 'volunteer') {
    throw evidenceError('Only the assigned volunteer can upload work evidence', 403, 'FORBIDDEN');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) throw evidenceError('Complaint not found', 404, 'NOT_FOUND');
  const volunteerId = new mongoose.Types.ObjectId(req.user.sub);
  const isAssignedVolunteer = String(complaint.assignedVolunteer) === String(volunteerId)
    && await Assignment.exists({ complaint: complaint._id, volunteer: volunteerId, isActive: true });
  if (!isAssignedVolunteer) {
    throw evidenceError('Only the active assigned volunteer can upload work evidence', 403, 'FORBIDDEN');
  }

  const expectedStatus = stage === 'before' ? 'assigned' : 'in_progress';
  if (complaint.status !== expectedStatus) {
    throw evidenceError(`Upload ${stage} images while the complaint is ${expectedStatus.replaceAll('_', ' ')}`, 409, 'INVALID_STATUS');
  }

  const target = stage === 'before' ? complaint.beforeImages : complaint.afterImages;
  if (target.length + files.length > 5) {
    throw evidenceError(`A maximum of 5 ${stage} images can be attached to one complaint`, 400, 'UPLOAD_VALIDATION_ERROR');
  }

  const metadataByFile = await Promise.all(files.map((file) => extractEvidenceMetadata(file)));
  const uploaded = await uploadImagesToCloudinary(files, req.user.sub, {
    purpose: 'work-evidence',
    complaintId: complaint._id
  });
  const existingUrls = new Set(target.map((image) => image.url).filter(Boolean));
  const uniqueUploads = [];
  const duplicateUploads = [];
  for (const image of uploaded) {
    if (!image.url || existingUrls.has(image.url)) duplicateUploads.push(image);
    else { existingUrls.add(image.url); uniqueUploads.push(image); }
  }
  const evidence = uniqueUploads.map((image) => ({
    ...image,
    uploadedBy: volunteerId,
    stage,
    imageMetadata: metadataByFile[uploaded.indexOf(image)]
  }));
  if (!evidence.length) {
    await deleteImagesFromCloudinary(uploaded);
    throw evidenceError('No unique evidence images were uploaded', 409, 'DUPLICATE_EVIDENCE');
  }
  const uniqueExisting = [];
  const savedUrls = new Set();
  for (const image of target) {
    if (!image.url || savedUrls.has(image.url)) continue;
    savedUrls.add(image.url);
    uniqueExisting.push(image);
  }
  target.splice(0, target.length, ...uniqueExisting, ...evidence);
  const previousStatus = complaint.status;
  if (stage === 'after') {
    complaint.status = 'needs_review';
    complaint.statusHistory.push({
      eventType: 'status_changed',
      previousStatus,
      status: 'needs_review',
      changedBy: volunteerId,
      assignedVolunteer: volunteerId,
      note: 'Completion photos submitted for review',
      changedAt: new Date()
    });
  }

  try {
    await complaint.save();
  } catch (error) {
    await deleteImagesFromCloudinary(uploaded);
    throw error;
  }
  if (duplicateUploads.length) await deleteImagesFromCloudinary(duplicateUploads);
  try {
    await notifyComplaintImagesUploaded({ complaint, uploaderId: volunteerId, count: evidence.length, stage });
  } catch (error) {
    console.error('Work evidence notification failed:', error.message);
  }

  await recordAudit({ req, action: 'complaint.evidence_uploaded', entityType: 'complaint', entityId: complaint._id, previousValue: stage === 'after' ? previousStatus : undefined, newValue: stage === 'after' ? 'needs_review' : undefined, metadata: { stage, count: evidence.length } });
  if (stage === 'after' && complaint.beforeImages.length > 0) {
    complaint.completionVerification = await queueCompletionVerification(complaint._id);
  }
  publishComplaintUpdate(complaint, 'complaint:status');

  return { stage, images: target, completionVerification: complaint.completionVerification };
}
