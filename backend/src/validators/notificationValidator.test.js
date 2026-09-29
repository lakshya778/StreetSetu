import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNotificationList } from './notificationValidator.js';

test('notification list normalizes pagination, search, and event filters', () => {
  const req = { query: { page: '2', limit: '15', search: '  status ', eventType: 'status_changed' } };
  let validationError;
  validateNotificationList(req, {}, (error) => { validationError = error; });
  assert.equal(validationError, undefined);
  assert.deepEqual(req.notificationQuery, { page: 2, limit: 15, complaintId: undefined, unread: false, search: 'status', eventType: 'status_changed' });
});

test('notification list rejects unsafe query types', () => {
  const req = { query: { search: ['*'], page: ['1'] } };
  let validationError;
  validateNotificationList(req, {}, (error) => { validationError = error; });
  assert.equal(validationError?.statusCode, 400);
  assert.ok(validationError.details.some((detail) => detail.field === 'search'));
  assert.ok(validationError.details.some((detail) => detail.field === 'page'));
});
