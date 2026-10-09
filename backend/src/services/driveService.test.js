import test from 'node:test';
import assert from 'node:assert/strict';
import Drive from '../models/Drive.js';
import gamificationService from './gamificationService.js';
import { createDrive, joinDrive, leaveDrive, listDrives } from './driveService.js';

const creatorId = '507f1f77bcf86cd799439011';
const visitorId = '507f1f77bcf86cd799439012';
const reqFor = (sub) => ({ user: { sub } });

test('creating a drive adds its creator and list serializes participation without exposing participant ids', async (t) => {
  const awarded = t.mock.method(gamificationService, 'awardPoints', async () => true);
  let stored;
  t.mock.method(Drive, 'create', async (data) => {
    stored = { ...data, _id: '507f1f77bcf86cd799439013', toObject() { return this; } };
    return stored;
  });
  t.mock.method(Drive, 'find', () => ({
    sort() { return this; },
    limit() { return this; },
    lean: async () => [stored]
  }));
  const created = await createDrive({ title: 'Park clean-up', date: new Date(Date.now() + 3600000) }, reqFor(creatorId));
  assert.deepEqual(stored.participants, [creatorId]);
  const listed = await listDrives(reqFor(creatorId));
  assert.equal(listed[0].participantCount, 1);
  assert.equal(listed[0].isParticipating, true);
  assert.equal(Object.hasOwn(listed[0], 'participants'), false);
  assert.equal(created.isParticipating, true);
  assert.equal(awarded.mock.calls.length, 1);
  assert.deepEqual(awarded.mock.calls[0].arguments.slice(0, 2), [creatorId, 'drive_organized']);
});

test('join and leave use set-based participant updates', async (t) => {
  const awarded = t.mock.method(gamificationService, 'awardPoints', async () => true);
  let filter;
  let update;
  const drive = {
    _id: '507f1f77bcf86cd799439013',
    title: 'Park clean-up',
    description: 'A neighbourhood clean-up event.',
    locationText: 'Central Park',
    date: new Date(Date.now() + 3600000),
    status: 'upcoming',
    participants: [visitorId]
  };
  t.mock.method(Drive, 'findOneAndUpdate', (query, payload) => {
    filter = query;
    update = payload;
    return { lean: async () => drive };
  });
  const joined = await joinDrive(drive._id, reqFor(visitorId));
  assert.deepEqual(update.$addToSet, { participants: visitorId });
  assert.deepEqual(update.$push.participantHistory.user, visitorId);
  assert.ok(update.$push.participantHistory.joinedAt instanceof Date);
  assert.equal(filter.status, 'upcoming');
  assert.deepEqual(filter.participants, { $ne: visitorId });
  assert.equal(joined.participantCount, 1);
  assert.deepEqual(awarded.mock.calls[0].arguments.slice(0, 2), [visitorId, 'drive_joined']);
  await leaveDrive(drive._id, reqFor(visitorId));
  assert.deepEqual(update.$pull, { participants: visitorId });
  assert.equal(awarded.mock.calls.length, 1);
});
