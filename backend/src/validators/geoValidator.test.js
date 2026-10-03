import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNearbyComplaints } from './geoValidator.js';

function validate(query) {
  const req = { query };
  let error;
  validateNearbyComplaints(req, {}, (nextError) => { error = nextError; });
  return { req, error };
}

test('nearby complaint discovery accepts the radius parameter in meters', () => {
  const { req, error } = validate({ latitude: '28.61', longitude: '77.20', radius: '500' });
  assert.equal(error, undefined);
  assert.equal(req.geoQuery.radiusMeters, 500);
});

test('nearby complaint discovery rejects out-of-range coordinates and radius', () => {
  const { error } = validate({ latitude: '91', longitude: '181', radius: '60000' });
  assert.equal(error?.statusCode, 400);
  assert.equal(error.details.length, 3);
});
