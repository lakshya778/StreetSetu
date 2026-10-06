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
  const evidence = uploaded.map((image, index) => ({
    ...image,
    uploadedBy: volunteerId,
    stage,
    imageMetadata: metadataByFile[index]
  }));
  target.push(...evidence);

  try {
    await complaint.save();
  } catch (error) {
    await deleteImagesFromCloudinary(uploaded);
    throw error;
  }
  try {
    await notifyComplaintImagesUploaded({ complaint, uploaderId: volunteerId, count: evidence.length, stage });
  } catch (error) {
    console.error('Work evidence notification failed:', error.message);
  }

  await recordAudit({ req, action: 'complaint.evidence_uploaded', entityType: 'complaint', entityId: complaint._id, metadata: { stage, count: evidence.length } });
  if (stage === 'after' && complaint.beforeImages.length > 0) {
    complaint.completionVerification = await queueCompletionVerification(complaint._id);
  }
  publishComplaintUpdate(complaint, 'complaint:status');

  return { stage, images: target, completionVerification: complaint.completionVerification };
}
