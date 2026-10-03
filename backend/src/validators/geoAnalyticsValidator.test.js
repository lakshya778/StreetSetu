import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeoAnalyticsQuery } from './geoAnalyticsValidator.js';

function validate(query) {
  const req = { query };
  let validationError;
  validateGeoAnalyticsQuery(req, {}, (error) => { validationError = error; });
  return { req, validationError };
}

test('geographic analytics accepts category, status, and date filters', () => {
  const { req, validationError } = validate({ category: 'roads', status: 'resolved', from: '2025-01-01', to: '2025-02-01', kind: 'resolved' });
  assert.equal(validationError, undefined);
  assert.equal(req.geoAnalyticsQuery.category, 'roads');
  assert.equal(req.geoAnalyticsQuery.kind, 'resolved');
});

test('geographic analytics rejects invalid statuses and reversed date ranges', () => {
  const { validationError } = validate({ status: 'unknown', from: '2025-03-01', to: '2025-01-01' });
  assert.equal(validationError?.statusCode, 400);
  assert.equal(validationError.details.length, 2);
});
