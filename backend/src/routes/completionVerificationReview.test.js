import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import Complaint from '../models/Complaint.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import { signToken } from '../config/jwt.js';
import { queueCompletionVerification } from '../services/completionVerificationService.js';
import assignmentRoutes from './assignmentRoutes.js';

const complaintId = '65f0c3123456789012345678';
const adminId = '65f0c3123456789012345679';
const volunteerId = '65f0c3123456789012345680';

async function listen(t, app) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('evidence review API rejects back to in progress, then approves replacement proof', async (t) => {
  const state = {
    _id: complaintId,
    title: 'Demo street repair',
    status: 'needs_review',
    createdBy: '65f0c3123456789012345681',
    assignedVolunteer: volunteerId,
    beforeImages: [{ url: 'before-image', uploadedAt: new Date('2026-10-08T07:00:00Z') }],
    afterImages: [{ url: 'original-proof', uploadedAt: new Date('2026-10-08T08:00:00Z') }],
    completionEvidenceHistory: [],
    statusHistory: [{
      eventType: 'status_changed',
      previousStatus: 'in_progress',
      status: 'needs_review',
      changedBy: volunteerId,
      captureSource: 'live_camera',
      proofHashes: ['a'.repeat(64)],
      changedAt: new Date('2026-10-08T08:00:00Z')
    }],
    completionVerification: {
      verificationStatus: 'needs_review',
      evidenceFingerprint: 'original-evidence',
      requestedAt: new Date('2026-10-08T08:00:00Z')
    },
    async save() { return this; }
  };

  t.mock.method(Complaint, 'findById', async () => state);
  t.mock.method(AuditLog, 'create', async () => ({}));
  t.mock.method(User, 'find', () => ({ select: async () => [] }));

  const app = express();
  app.use(express.json());
  app.use('/api/v1/assignments', assignmentRoutes);
  const baseUrl = await listen(t, app);
  const token = signToken({ sub: adminId, role: 'admin' });

  const rejectedResponse = await fetch(`${baseUrl}/api/v1/assignments/completion-verifications/${complaintId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: 'reject' })
  });
  assert.equal(rejectedResponse.status, 200);
  const rejected = (await rejectedResponse.json()).data;
  assert.equal(rejected.status, 'in_progress');
  assert.equal(rejected.completionVerification.verificationStatus, 'rejected');
  assert.equal(rejected.completionVerification.reviewDecision, 'rejected');
  assert.equal(rejected.statusHistory.at(-1).previousStatus, 'needs_review');
  assert.equal(rejected.statusHistory.at(-1).status, 'in_progress');
  assert.equal(rejected.statusHistory.at(-1).changedBy, adminId);
  assert.equal(rejected.statusHistory.at(-1).note, 'Admin rejected completion evidence');
  assert.equal(rejected.afterImages.length, 0);
  assert.equal(rejected.completionEvidenceHistory[0].verificationStatus, 'rejected');
  assert.equal(rejected.completionEvidenceHistory[0].images[0].url, 'original-proof');

  state.status = 'needs_review';
  state.afterImages.push({ url: 'replacement-proof', uploadedAt: new Date() });
  state.statusHistory.push({
    eventType: 'status_changed',
    previousStatus: 'in_progress',
    status: 'needs_review',
    changedBy: volunteerId,
    captureSource: 'live_camera',
    proofHashes: ['b'.repeat(64)],
    changedAt: new Date()
  });
  const timerMock = t.mock.method(globalThis, 'setTimeout', () => 0);
  try {
    await queueCompletionVerification(complaintId);
  } finally {
    timerMock.mock.restore();
  }
  assert.equal(state.completionVerification.verificationStatus, 'pending');
  assert.equal(state.afterImages.length, 1);
  assert.equal(state.afterImages[0].url, 'replacement-proof');
  assert.equal(state.completionEvidenceHistory[0].images[0].url, 'original-proof');
  state.completionVerification.verificationStatus = 'needs_review';

  const approvedResponse = await fetch(`${baseUrl}/api/v1/assignments/completion-verifications/${complaintId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: 'approve' })
  });
  assert.equal(approvedResponse.status, 200);
  const approved = (await approvedResponse.json()).data;
  assert.equal(approved.status, 'resolved');
  assert.equal(approved.completionVerification.verificationStatus, 'verified');
  assert.equal(approved.statusHistory.at(-1).previousStatus, 'needs_review');
  assert.equal(approved.statusHistory.at(-1).status, 'resolved');
  assert.equal(approved.statusHistory.at(-1).changedBy, adminId);
  assert.equal(approved.statusHistory[0].proofHashes[0], 'a'.repeat(64));
  assert.equal(approved.statusHistory.at(-2).proofHashes[0], 'b'.repeat(64));
});

test('completion verification schema accepts rejected evidence state', async () => {
  const complaint = new Complaint({
    title: 'Evidence resubmission',
    description: 'Replacement completion proof will be uploaded.',
    category: 'roads',
    location: { type: 'Point', coordinates: [77.2, 28.6] },
    longitude: 77.2,
    latitude: 28.6,
    createdBy: adminId,
    completionVerification: { verificationStatus: 'rejected', reviewDecision: 'rejected', reviewedBy: adminId, reviewedAt: new Date() },
    completionEvidenceHistory: [{
      images: [{ url: 'rejected-proof', mimeType: 'image/jpeg' }],
      verificationStatus: 'rejected',
      reviewedBy: adminId,
      reviewedAt: new Date()
    }]
  });
  await complaint.validate();
});
