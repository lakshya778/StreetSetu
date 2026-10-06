import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';
import { emitToRole, publishComplaintUpdate } from './realtimeService.js';
import { recordAudit } from './auditService.js';

const activeVerifications = new Set();

function evidenceFingerprint(complaint) {
  const evidence = [...complaint.beforeImages, ...complaint.afterImages]
    .map(({ url, uploadedAt, imageMetadata }) => ({ url, uploadedAt, imageMetadata }));
  return createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

function serviceUrl(path) {
  if (!process.env.AI_SERVICE_URL) throw new Error('AI completion verification service is not configured');
  return `${process.env.AI_SERVICE_URL.replace(/\/$/, '')}${path}`;
}

function authHeaders() {
  return process.env.AI_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}` } : {};
}

async function readServiceResponse(response) {
  let body;
  try { body = await response.json(); } catch { throw new Error('AI service returned an invalid response'); }
  if (!response.ok) throw new Error(body.error || `AI service returned HTTP ${response.status}`);
  return body.data || body;
}

export async function extractEvidenceMetadata(file) {
  try {
    const form = new FormData();
    form.append('image', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'evidence-image');
    const response = await fetch(serviceUrl('/v1/image-metadata'), {
      method: 'POST', headers: authHeaders(), body: form,
      signal: AbortSignal.timeout(Number.parseInt(process.env.AI_METADATA_TIMEOUT_MS, 10) || 8000)
    });
    return await readServiceResponse(response);
  } catch (error) {
    console.warn('Evidence EXIF extraction unavailable:', error.message);
    return { latitude: null, longitude: null, capturedAt: null };
  }
}

export async function queueCompletionVerification(complaintId) {
  if (!mongoose.isValidObjectId(complaintId)) return;
  const complaint = await Complaint.findById(complaintId);
  if (!complaint || !complaint.beforeImages.length || !complaint.afterImages.length) return;
  complaint.completionVerification = {
    verificationStatus: 'pending',
    requestedAt: new Date(),
    evidenceFingerprint: evidenceFingerprint(complaint),
    reviewDecision: undefined,
    reviewedBy: undefined,
    reviewedAt: undefined
  };
  await complaint.save();
  scheduleVerification(String(complaint._id));
  publishComplaintUpdate(complaint, 'complaint:status');
  return complaint.completionVerification;
}

function scheduleVerification(complaintId) {
  if (activeVerifications.has(complaintId)) return;
  activeVerifications.add(complaintId);
  setTimeout(() => { void runVerification(complaintId); }, 0);
}

async function runVerification(complaintId) {
  let fingerprint;
  try {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint || complaint.completionVerification?.verificationStatus !== 'pending') return;
    fingerprint = evidenceFingerprint(complaint);
    const payload = {
      location: { latitude: complaint.latitude, longitude: complaint.longitude },
      beforeImages: complaint.beforeImages.map(({ url, imageMetadata, uploadedAt }) => ({ url, imageMetadata, uploadedAt })),
      afterImages: complaint.afterImages.map(({ url, imageMetadata, uploadedAt }) => ({ url, imageMetadata, uploadedAt }))
    };
    const response = await fetch(serviceUrl('/v1/verify-completion'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Number.parseInt(process.env.AI_VERIFICATION_TIMEOUT_MS, 10) || 120000)
    });
    const result = await readServiceResponse(response);
    const latest = await Complaint.findById(complaintId);
    if (!latest || latest.completionVerification?.verificationStatus !== 'pending'
      || evidenceFingerprint(latest) !== fingerprint) return;
    latest.completionVerification = { ...result, evidenceFingerprint: fingerprint, requestedAt: latest.completionVerification.requestedAt, checkedAt: new Date() };
    await latest.save();
    publishComplaintUpdate(latest, 'complaint:status');
    emitToRole('admin', 'dashboard:updated', { complaintId, eventType: 'completion_verification' });
  } catch (error) {
    console.error(`Completion verification failed for complaint ${complaintId}:`, error);
    try {
      const complaint = await Complaint.findById(complaintId);
      if (complaint?.completionVerification?.verificationStatus === 'pending'
        && evidenceFingerprint(complaint) === fingerprint) {
        complaint.completionVerification.similarityScore = 0;
        complaint.completionVerification.gpsMatched = false;
        complaint.completionVerification.timestampValid = false;
        complaint.completionVerification.fraudScore = 100;
        complaint.completionVerification.verificationStatus = 'needs_review';
        complaint.completionVerification.failureReason = 'Automated verification could not complete. Admin review is required.';
        complaint.completionVerification.checkedAt = new Date();
        await complaint.save();
        publishComplaintUpdate(complaint, 'complaint:status');
        emitToRole('admin', 'dashboard:updated', { complaintId, eventType: 'completion_verification' });
      }
    } catch (persistError) {
      console.error(`Could not persist completion verification failure for ${complaintId}:`, persistError);
    }
  } finally {
    activeVerifications.delete(complaintId);
    const latest = await Complaint.findById(complaintId).select('completionVerification').catch(() => null);
    if (latest?.completionVerification?.verificationStatus === 'pending') scheduleVerification(complaintId);
  }
}

export function ensureVerificationProcessing(complaint) {
  if (complaint?.completionVerification?.verificationStatus === 'pending') scheduleVerification(String(complaint._id));
}

export async function requireVerifiedCompletion(complaint) {
  let verification = complaint.completionVerification;
  if (!verification && complaint.beforeImages.length && complaint.afterImages.length) {
    verification = await queueCompletionVerification(complaint._id);
  }
  if (verification?.verificationStatus === 'pending') {
    ensureVerificationProcessing(complaint);
    const error = new Error('Completion photos are being checked. Please retry in a few moments.');
    error.statusCode = 409; error.code = 'VERIFICATION_PENDING'; throw error;
  }
  if (verification?.verificationStatus !== 'verified') {
    const error = new Error('Completion evidence needs admin review before this complaint can be resolved.');
    error.statusCode = 409; error.code = 'VERIFICATION_NEEDS_REVIEW'; throw error;
  }
}

export async function getCompletionVerification(complaintId, req) {
  if (!mongoose.isValidObjectId(complaintId)) {
    const error = new Error('Complaint id must be valid'); error.statusCode = 400; error.code = 'VALIDATION_ERROR'; throw error;
  }
  const complaint = await Complaint.findById(complaintId).select('_id assignedVolunteer assignedTo beforeImages afterImages completionVerification');
  if (!complaint) {
    const error = new Error('Complaint not found'); error.statusCode = 404; error.code = 'NOT_FOUND'; throw error;
  }
  if (req.user.role === 'volunteer'
    && String(complaint.assignedVolunteer || complaint.assignedTo) !== String(req.user.sub)) {
    const error = new Error('Only the assigned volunteer can view completion verification'); error.statusCode = 403; error.code = 'FORBIDDEN'; throw error;
  }
  if (!complaint.completionVerification && complaint.beforeImages.length && complaint.afterImages.length) {
    return await queueCompletionVerification(complaint._id);
  }
  ensureVerificationProcessing(complaint);
  return complaint.completionVerification || { verificationStatus: 'not_started' };
}

export async function listCompletionVerifications(limit = 100) {
  const complaints = await Complaint.find({ 'completionVerification.verificationStatus': { $in: ['verified', 'needs_review', 'pending'] } })
    .select('_id title category status address createdAt assignedVolunteer assignedTo completionVerification')
    .populate('assignedVolunteer', 'name')
    .populate('assignedTo', 'name')
    .sort({ 'completionVerification.requestedAt': -1 })
    .limit(limit)
    .lean();
  complaints.filter((complaint) => complaint.completionVerification?.verificationStatus === 'pending')
    .forEach((complaint) => ensureVerificationProcessing(complaint));
  return complaints;
}

export async function reviewCompletionVerification(complaintId, decision, req) {
  if (!mongoose.isValidObjectId(complaintId)) {
    const error = new Error('Complaint id must be valid'); error.statusCode = 400; error.code = 'VALIDATION_ERROR'; throw error;
  }
  if (!['approve', 'reject'].includes(decision)) {
    const error = new Error('Decision must be approve or reject'); error.statusCode = 400; error.code = 'VALIDATION_ERROR'; throw error;
  }
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    const error = new Error('Complaint not found'); error.statusCode = 404; error.code = 'NOT_FOUND'; throw error;
  }
  if (!complaint.completionVerification || complaint.completionVerification.verificationStatus === 'pending') {
    const error = new Error('Completion verification is not ready for review'); error.statusCode = 409; error.code = 'VERIFICATION_PENDING'; throw error;
  }
  complaint.completionVerification.verificationStatus = decision === 'approve' ? 'verified' : 'needs_review';
  complaint.completionVerification.reviewDecision = decision === 'approve' ? 'approved' : 'rejected';
  complaint.completionVerification.reviewedBy = req.user.sub;
  complaint.completionVerification.reviewedAt = new Date();
  if (decision === 'reject') complaint.completionVerification.failureReason = 'Admin review rejected the submitted completion evidence.';
  await complaint.save();
  await recordAudit({ req, action: decision === 'approve' ? 'complaint.completion_verification_approved' : 'complaint.completion_verification_rejected', entityType: 'complaint', entityId: complaint._id, metadata: { fraudScore: complaint.completionVerification.fraudScore } });
  publishComplaintUpdate(complaint, 'complaint:status');
  emitToRole('admin', 'dashboard:updated', { complaintId: String(complaint._id), eventType: 'completion_verification_reviewed' });
  return complaint.completionVerification;
}
