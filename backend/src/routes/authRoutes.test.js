import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import User from '../models/User.js';
import Complaint from '../models/Complaint.js';
import RefreshSession from '../models/RefreshSession.js';
import gamificationService from '../services/gamificationService.js';
import authRoutes from './authRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { requestContext } from '../middleware/requestContext.js';

const USER_ID = '65f0c3123456789012345678';

async function postRegistration(t, body, createUser) {
  const createdUsers = [];
  t.mock.method(User, 'create', async (document) => {
    createdUsers.push(document);
    return createUser ? createUser(document) : {
      _id: USER_ID,
      name: document.name,
      email: document.email,
      role: document.role,
      referralCode: document.referralCode || 'ABCDEF123456',
      toJSON() {
        return {
          _id: USER_ID,
          name: this.name,
          email: this.email,
          role: this.role,
          referralCode: this.referralCode,
          ...(document.location ? { location: document.location } : {})
        };
      }
    };
  });

  t.mock.method(RefreshSession, 'create', async () => ({}));

  const app = express();
  app.use(requestContext);
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  app.use(errorHandler);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { response, createdUsers };
}

const registration = (role, extra = {}) => ({
  name: 'Test User',
  email: `${role}-${Math.random().toString(16).slice(2)}@example.test`,
  password: 'strong-password-123',
  role,
  ...extra
});

test('registration accepts an optional normalized referral code', async (t) => {
  const referrerId = '65f0c3123456789012345682';
  t.mock.method(User, 'findOne', () => ({
    select: () => ({ lean: async () => ({ _id: referrerId, email: 'referrer@example.test' }) })
  }));
  const award = t.mock.method(gamificationService, 'awardPoints', async () => true);
  const { response, createdUsers } = await postRegistration(t, registration('citizen', { referralCode: ' abcd12 ' }));
  assert.equal(response.status, 201);
  assert.equal(createdUsers[0].referredBy, referrerId);
  assert.deepEqual(award.mock.calls[0].arguments, [referrerId, 'referral_bonus', USER_ID]);
});

test('registration rejects unknown referral codes before creating an account', async (t) => {
  t.mock.method(User, 'findOne', () => ({
    select: () => ({ lean: async () => null })
  }));
  const { response, createdUsers } = await postRegistration(t, registration('citizen', { referralCode: 'NOTREAL123' }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_REFERRAL_CODE');
  assert.equal(createdUsers.length, 0);
});

test('citizen and volunteer registration succeeds without a location field', async (t) => {
  for (const role of ['citizen', 'volunteer']) {
    const { response, createdUsers } = await postRegistration(t, registration(role));
    assert.equal(response.status, 201);
    assert.equal(Object.hasOwn(createdUsers[0], 'location'), false);
    assert.equal(Object.hasOwn((await response.json()).data.user, 'location'), false);
  }
});

test('registration omits an empty or partial GeoJSON location', async (t) => {
  const { response, createdUsers } = await postRegistration(t, registration('volunteer', {
    location: { type: 'Point', coordinates: [77.209] }
  }));
  assert.equal(response.status, 201);
  assert.equal(Object.hasOwn(createdUsers[0], 'location'), false);
});

test('registration persists a valid GeoJSON Point', async (t) => {
  const location = { type: 'Point', coordinates: [77.209, 28.6139] };
  const { response, createdUsers } = await postRegistration(t, registration('volunteer', { location }));
  assert.equal(response.status, 201);
  assert.deepEqual(createdUsers[0].location, location);
  assert.deepEqual((await response.json()).data.user.location, location);
});

test('registration rejects out-of-range coordinates', async (t) => {
  const { response, createdUsers } = await postRegistration(t, registration('volunteer', {
    location: { type: 'Point', coordinates: [181, 28.6139] }
  }));
  assert.equal(response.status, 400);
  assert.equal(createdUsers.length, 0);
});

test('registration errors are logged with request id and hide internal details', async (t) => {
  const logs = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logs.push(args);
  t.after(() => { console.error = originalConsoleError; });
  const { response } = await postRegistration(t, registration('citizen'), async () => {
    throw Object.assign(new Error('Mongo internal failure'), { code: 16755 });
  });
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
  assert.equal(body.error.message, 'An unexpected error occurred');
  assert.equal(body.error.details, undefined);
  assert.equal(body.error.message.includes('Mongo internal failure'), false);
  assert.equal(body.meta.requestId, response.headers.get('x-request-id'));
  assert.equal(logs[0][1].requestId, body.meta.requestId);
  assert.equal(logs[0][1].error.message, 'Mongo internal failure');
});

test('user locations are optional, complete GeoJSON points are valid, and the geo index is sparse', async () => {
  const baseUser = { name: 'Test User', email: 'user@example.test', passwordHash: 'hash' };
  const withoutLocation = new User(baseUser);
  await withoutLocation.validate();
  assert.equal(Object.hasOwn(withoutLocation.toObject(), 'location'), false);

  const withLocation = new User({
    ...baseUser,
    location: { type: 'Point', coordinates: [77.209, 28.6139] }
  });
  await withLocation.validate();
  assert.deepEqual(withLocation.toObject().location, { type: 'Point', coordinates: [77.209, 28.6139] });

  const invalidLocation = new User({
    ...baseUser,
    location: { type: 'Point', coordinates: [181, 28.6139] }
  });
  await assert.rejects(invalidLocation.validate(), /Volunteer coordinates/);

  const userGeoIndex = User.schema.indexes().find(([fields]) => fields.location === '2dsphere');
  const complaintGeoIndex = Complaint.schema.indexes().find(([fields]) => fields.location === '2dsphere');
  assert.equal(userGeoIndex[1].sparse, true);
  assert.equal(complaintGeoIndex[1].sparse, true);
  assert.equal(Complaint.schema.path('location.type').defaultValue, undefined);
});
