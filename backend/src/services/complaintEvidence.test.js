import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateComplaintEvidenceUpload } from './complaintEvidence.js';

const now = new Date('2026-10-09T06:30:00.000Z');
const liveCapture = {
  captureSource: 'live_camera',
  latitude: 28.6139,
  longitude: 77.209,
  accuracy: 12,
  capturedAt: now.toISOString()
};

function upload(captureMetadata, options = {}) {
  return validateComplaintEvidenceUpload({
    files: [{ buffer: Buffer.from('captured-image') }],
    captureMetadata: JSON.stringify(captureMetadata),
    latitude: 28.6139,
    longitude: 77.209,
    now,
    env: {},
    ...options
  });
}

test('live camera uploads are accepted with normalized metadata and a server-computed hash', () => {
  const [photo] = upload([liveCapture]);
  assert.equal(photo.captureSource, 'live_camera');
  assert.deepEqual(photo.imageMetadata, {
    latitude: 28.6139,
    longitude: 77.209,
    accuracy: 12,
    capturedAt: now,
    captureSource: 'live_camera'
  });
  assert.equal(photo.proofHash, createHash('sha256').update('captured-image').digest('hex'));
  assert.equal(photo.evidenceFlag, undefined);
});

test('development gallery uploads are rejected in production', () => {
  assert.throws(
    () => upload([{ captureSource: 'dev_gallery' }], {
      env: { ALLOW_DEV_GALLERY_PROOF: 'true', NODE_ENV: 'production' }
    }),
    (error) => error.statusCode === 400 && error.message === 'Live camera capture required'
  );
});

test('an upload with missing captureSource is rejected', () => {
  assert.throws(
    () => upload([{ ...liveCapture, captureSource: undefined }]),
    (error) => error.statusCode === 400 && error.message === 'Live camera capture required'
  );
});

test('a live photo over 200 metres from the complaint pin is flagged without rejection', () => {
  const [photo] = upload([{ ...liveCapture, latitude: 28.616 }]);
  assert.equal(photo.evidenceFlag, 'location_mismatch');
});

test('a live photo captured more than five minutes ago is flagged for time review', () => {
  const [photo] = upload([{
    ...liveCapture,
    capturedAt: new Date(now.getTime() - 5 * 60 * 1000 - 1).toISOString()
  }]);
  assert.equal(photo.evidenceFlag, 'time_mismatch');
});

test('development gallery uploads require the explicit non-production opt-in', () => {
  const [photo] = upload([{ captureSource: 'dev_gallery' }], {
    env: { ALLOW_DEV_GALLERY_PROOF: 'true', NODE_ENV: 'development' }
  });
  assert.equal(photo.captureSource, 'dev_gallery');
  assert.equal(photo.evidenceTag, 'dev_gallery');
  assert.deepEqual(photo.imageMetadata, { captureSource: 'dev_gallery' });
});
