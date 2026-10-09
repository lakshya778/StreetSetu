import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLeaderboardQuery } from '../validators/gamificationValidator.js';

function runValidator(query) {
  const req = { query };
  let nextError;
  const res = {
    statusCode: 200,
    body: null,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; }
  };
  validateLeaderboardQuery(req, res, (error) => { nextError = error; });
  return { req, res, nextError };
}

test('leaderboard accepts a safely bounded neighbourhood name as a ward filter', () => {
  const { req, res, nextError } = runValidator({ scope: 'month', ward: '  New Town ' });
  assert.equal(res.statusCode, 200);
  assert.equal(nextError, undefined);
  assert.deepEqual(req.leaderboardQuery, { scope: 'month', ward: 'New Town' });
});

test('leaderboard rejects unsafe or oversized neighbourhood filters', () => {
  for (const ward of ['Area;$where=true', 'x'.repeat(161), ['Area']]) {
    const { res } = runValidator({ ward });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});
