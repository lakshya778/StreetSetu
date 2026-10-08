import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
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

function haversineDistanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  const boundedA = Math.min(1, a);
  return 6371000 * 2 * Math.atan2(Math.sqrt(boundedA), Math.sqrt(1 - boundedA));
}

function parseLiveCapture(body) {
  if (['latitude', 'longitude', 'accuracy', 'capturedAt'].some((field) => (
    typeof body[field] !== 'string' || body[field].trim() === ''
  ))) {
    throw evidenceError('Valid live camera location and capture time are required', 400, 'INVALID_CAPTURE_METADATA');
  }
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy = Number(body.accuracy);
  const capturedAt = new Date(body.capturedAt);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || !Number.isFinite(accuracy) || accuracy < 0
    || typeof body.capturedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(body.capturedAt)
    || Number.isNaN(capturedAt.getTime())) {
    throw evidenceError('Valid live camera location and capture time are required', 400, 'INVALID_CAPTURE_METADATA');
  }
  return { latitude, longitude, accuracy, capturedAt };
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

  let captureSource;
  let liveCapture;
  let receivedAt;
  if (stage === 'after') {
    captureSource = req.body.captureSource;
    if (captureSource === 'dev_gallery') {
      if (process.env.ALLOW_DEV_GALLERY_PROOF !== 'true' || process.env.NODE_ENV === 'production') {
        throw evidenceError('Live camera capture required', 400, 'LIVE_CAMERA_REQUIRED');
      }
    } else if (captureSource === 'live_camera') {
      liveCapture = parseLiveCapture(req.body);
      receivedAt = new Date();
    } else {
      throw evidenceError('Live camera capture required', 400, 'LIVE_CAMERA_REQUIRED');
    }
  }

  const target = stage === 'before' ? complaint.beforeImages : complaint.afterImages;
  if (target.length + files.length > 5) {
    throw evidenceError(`A maximum of 5 ${stage} images can be attached to one complaint`, 400, 'UPLOAD_VALIDATION_ERROR');
  }

  const exifMetadata = await Promise.all(files.map((file) => extractEvidenceMetadata(file)));
  const metadataByFile = stage === 'after' && captureSource === 'live_camera'
    ? files.map(() => ({
      latitude: liveCapture.latitude,
      longitude: liveCapture.longitude,
      accuracy: liveCapture.accuracy,
      capturedAt: liveCapture.capturedAt
    }))
    : exifMetadata;
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
  let verificationFailureReason = null;
  let distance = null;
  if (stage === 'after') {
    if (captureSource === 'dev_gallery') {
      verificationFailureReason = 'Development gallery evidence needs admin review.';
    } else {
      const timeDifference = Math.abs(receivedAt.getTime() - liveCapture.capturedAt.getTime());
      distance = haversineDistanceMeters(complaint.latitude, complaint.longitude, liveCapture.latitude, liveCapture.longitude);
      if (timeDifference > 2 * 60 * 1000) verificationFailureReason = 'Capture time mismatch';
      else if (distance > 100) verificationFailureReason = `Photo taken ${Math.round(distance)} m away from reported location`;
      else if (liveCapture.accuracy > 100) verificationFailureReason = 'Low GPS accuracy';
    }
    complaint.status = 'needs_review';
    complaint.statusHistory.push({
      eventType: 'status_changed',
      previousStatus,
      status: 'needs_review',
      changedBy: volunteerId,
      assignedVolunteer: volunteerId,
      note: verificationFailureReason || 'Completion photos submitted for verification',
      captureSource,
      proofHashes: files.map((file) => createHash('sha256').update(file.buffer).digest('hex')),
      ...(captureSource === 'live_camera' ? {
        gpsSource: 'device',
        distance,
        accuracy: liveCapture.accuracy,
        capturedAt: liveCapture.capturedAt
      } : {}),
      changedAt: receivedAt || new Date()
    });
    if (verificationFailureReason) {
      complaint.completionVerification = {
        verificationStatus: 'needs_review',
        failureReason: verificationFailureReason,
        requestedAt: receivedAt || new Date(),
        checkedAt: receivedAt || new Date(),
        gpsMatched: captureSource === 'live_camera' ? distance <= 100 : undefined,
        gpsDistanceMeters: distance ?? undefined,
        timestampValid: captureSource === 'live_camera' ? Math.abs(receivedAt.getTime() - liveCapture.capturedAt.getTime()) <= 2 * 60 * 1000 : undefined
      };
    }
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
  if (stage === 'after' && !verificationFailureReason && complaint.beforeImages.length > 0) {
    complaint.completionVerification = await queueCompletionVerification(complaint._id);
  }
  publishComplaintUpdate(complaint, 'complaint:status');

  const workStartPhotos = complaint.beforeImages;
  const completionPhotos = complaint.afterImages;
  console.info('[Evidence] saved', {
    complaintId: String(complaint._id),
    stage,
    workStartPhotosCount: workStartPhotos.length,
    completionPhotosCount: completionPhotos.length,
    status: complaint.status
  });
  return {
    stage,
    images: stage === 'before' ? workStartPhotos : completionPhotos,
    workStartPhotos,
    completionPhotos,
    beforeImages: workStartPhotos,
    afterImages: completionPhotos,
    status: complaint.status,
    completionVerification: complaint.completionVerification
  };
}
