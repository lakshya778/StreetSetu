import test from 'node:test';
import assert from 'node:assert/strict';
import Drive from '../models/Drive.js';
import { createDrive, joinDrive, leaveDrive, listDrives } from './driveService.js';

const creatorId = '507f1f77bcf86cd799439011';
const visitorId = '507f1f77bcf86cd799439012';
const reqFor = (sub) => ({ user: { sub } });

test('creating a drive adds its creator and list serializes participation without exposing participant ids', async (t) => {
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
});

test('join and leave use set-based participant updates', async (t) => {
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
  assert.equal(filter.status, 'upcoming');
  assert.equal(joined.participantCount, 1);
  await leaveDrive(drive._id, reqFor(visitorId));
  assert.deepEqual(update.$pull, { participants: visitorId });
});
