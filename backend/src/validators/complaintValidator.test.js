import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCreateComplaint, validateListComplaints, validateStatusUpdate } from './complaintValidator.js';

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
    longitude: 77.2
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
    isAnonymous: 'true'
  } };
  let validationError;
  validateCreateComplaint(req, {}, (error) => { validationError = error; });
  assert.equal(validationError?.statusCode, 400);
  assert.ok(validationError.details.some((detail) => detail.field === 'isAnonymous'));
});
