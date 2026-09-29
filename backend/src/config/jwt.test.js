import test from 'node:test';
import assert from 'node:assert/strict';
import { signRefreshToken, signToken, verifyRefreshToken, verifyToken } from './jwt.js';

process.env.JWT_SECRET = 'test-access-secret-with-adequate-length';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-adequate-length';

test('access tokens are signed and verified with the expected identity claims', () => {
  const token = signToken({ sub: 'user-1', role: 'volunteer' });
  const claims = verifyToken(token);
  assert.equal(claims.sub, 'user-1');
  assert.equal(claims.role, 'volunteer');
});

test('refresh tokens identify their type and token id', () => {
  const token = signRefreshToken({ sub: 'user-1' }, 'session-1');
  const claims = verifyRefreshToken(token);
  assert.equal(claims.tokenType, 'refresh');
  assert.equal(claims.jti, 'session-1');
  assert.equal(claims.sub, 'user-1');
});

test('access and refresh token secrets are not interchangeable', () => {
  const token = signRefreshToken({ sub: 'user-1' }, 'session-2');
  assert.throws(() => verifyToken(token));
});
