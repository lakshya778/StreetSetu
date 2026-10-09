import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateComplaint, validateDuplicateCheck, validateListComplaints, validateStatusUpdate } from './complaintValidator.js';

const liveAttachment = {
  url: 'https://images.example.test/report.jpg',
  mimeType: 'image/jpeg',
  size: 100,
  captureSource: 'live_camera',
  proofHash: 'a'.repeat(64),
  imageMetadata: {
    latitude: 28.6,
    longitude: 77.2,
    accuracy: 8,
    capturedAt: new Date().toISOString(),
    captureSource: 'live_camera'
  }
};

function validate(payload) {
  const req = { body: payload };
  let validationError;
  validateStatusUpdate(req, {}, (error) => { validationError = error; });
  return { req, validationError };
}

test('status validation requires a non-empty reason for rejected complaints', () => {
  const { validationError } = validate({ status: 'rejected', note: '   ' });

  assert.equal(validationError?.statusCode, 400);
  assert.equal(validationError?.details[0]?.field, 'note');
  assert.equal(validationError?.details[0]?.message, 'A rejection reason is required');
});

test('status validation trims and accepts a rejection reason', () => {
  const { req, validationError } = validate({ status: 'rejected', note: '  Not a civic issue  ' });

  assert.equal(validationError, undefined);
  assert.equal(req.body.note, 'Not a civic issue');
});

test('status validation keeps notes optional for non-rejection updates', () => {
  const { req, validationError } = validate({ status: 'under_review' });

  assert.equal(validationError, undefined);
  assert.equal(req.body.note, undefined);
});

test('complaint list supports bounded search and page filters', () => {
  const req = { query: { search: '  broken light ', page: '2', limit: '12', status: 'in_progress' } };
  let validationError;
  validateListComplaints(req, {}, (error) => { validationError = error; });
  assert.equal(validationError, undefined);
  assert.equal(req.query.search, 'broken light');
  assert.equal(req.query.page, '2');
  assert.equal(req.query.status, 'in_progress');
});

test('complaint list rejects non-string search query values', () => {
  const req = { query: { search: ['*'] } };
  let validationError;
  validateListComplaints(req, {}, (error) => { validationError = error; });
  assert.equal(validationError?.statusCode, 400);
  assert.ok(validationError.details.some((detail) => detail.field === 'search'));
});

test('complaint creation defaults anonymous reporting off and accepts an explicit opt-in', () => {
  const req = { body: {
    title: 'Overflowing bin near market',
    description: 'The public waste bin has been overflowing since yesterday.',
    category: 'waste_management',
    latitude: 28.6,
    longitude: 77.2,
    attachments: [liveAttachment]
  } };
  let validationError;
  validateCreateComplaint(req, {}, (error) => { validationError = error; });
  assert.equal(validationError, undefined);
  assert.equal(req.body.isAnonymous, false);

  req.body.isAnonymous = true;
  validateCreateComplaint(req, {}, (error) => { validationError = error; });
  assert.equal(validationError, undefined);
  assert.equal(req.body.isAnonymous, true);
});

test('complaint creation rejects non-boolean anonymous reporting values', () => {
  const req = { body: {
    title: 'Overflowing bin near market',
    description: 'The public waste bin has been overflowing since yesterday.',
    category: 'waste_management',
    latitude: 28.6,
    longitude: 77.2,
    attachments: [liveAttachment],
    isAnonymous: 'true'
  } };
  let validationError;
  validateCreateComplaint(req, {}, (error) => { validationError = error; });
  assert.equal(validationError?.statusCode, 400);
  assert.ok(validationError.details.some((detail) => detail.field === 'isAnonymous'));
});

test('complaint creation rejects an empty photo list', () => {
  const req = { body: {
    title: 'Overflowing bin near market',
    description: 'The public waste bin has been overflowing since yesterday.',
    category: 'waste_management',
    latitude: 28.6,
    longitude: 77.2,
    attachments: []
  } };
  let validationError;
  validateCreateComplaint(req, {}, (error) => { validationError = error; });
  assert.equal(validationError?.statusCode, 400);
  assert.ok(validationError.details.some((detail) => detail.field === 'attachments'));
});

test('complaint creation rejects any non-live capture source', () => {
  const req = { body: {
    title: 'Overflowing bin near market',
    description: 'The public waste bin has been overflowing since yesterday.',
    category: 'waste_management',
    latitude: 28.6,
    longitude: 77.2,
    attachments: [{ ...liveAttachment, captureSource: 'unsupported', imageMetadata: { ...liveAttachment.imageMetadata, captureSource: 'unsupported' } }]
  } };
  let validationError;
  validateCreateComplaint(req, {}, (error) => { validationError = error; });
  assert.equal(validationError?.statusCode, 400);
  assert.ok(validationError.details.some((detail) => detail.field === 'attachments.0.captureSource'));
});

test('duplicate checks remain valid without photo attachments', () => {
  const req = { body: {
    title: 'Overflowing bin near market',
    description: 'The public waste bin has been overflowing since yesterday.',
    category: 'waste_management',
    latitude: 28.6,
    longitude: 77.2
  } };
  let validationError;
  validateDuplicateCheck(req, {}, (error) => { validationError = error; });
  assert.equal(validationError, undefined);
  assert.deepEqual(req.body.attachments, []);
});
