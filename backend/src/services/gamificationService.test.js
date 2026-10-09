import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';
import Drive from '../models/Drive.js';
import PointEvent from '../models/PointEvent.js';
import User from '../models/User.js';
import Vote from '../models/Vote.js';
import gamificationService from './gamificationService.js';

const userId = '65f0c3123456789012345681';
const referenceId = '65f0c3123456789012345678';

function mockConnectedDatabase(t) {
  const previousState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;
  t.after(() => { mongoose.connection.readyState = previousState; });
}

test('point event is inserted once, increments balances atomically, and grants the first report badge', async (t) => {
  mockConnectedDatabase(t);
  const create = t.mock.method(PointEvent, 'create', async (event) => event);
  const aggregate = t.mock.method(PointEvent, 'aggregate', async () => [{ _id: 'report_created', count: 1 }]);
  const update = t.mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
  t.mock.method(User, 'findById', () => ({ select: () => ({ lean: async () => ({ totalPoints: 5 }) }) }));

  assert.equal(await gamificationService.awardPoints(userId, 'report_created', referenceId), true);
  assert.equal(create.mock.calls.length, 1);
  assert.equal(create.mock.calls[0].arguments[0].points, 5);
  assert.equal(create.mock.calls[0].arguments[0].refType, 'complaint');
  assert.match(create.mock.calls[0].arguments[0].month, /^\d{4}-\d{2}$/);
  assert.equal(update.mock.calls.length, 2);
  assert.deepEqual(update.mock.calls[0].arguments[1].$inc, { totalPoints: 5, monthlyPoints: 5 });
  assert.equal(update.mock.calls[1].arguments[0]['badges.key'].$ne, 'first_report');
  assert.equal(aggregate.mock.calls.length, 1);
});

test('duplicate point events do not increment user balances', async (t) => {
  mockConnectedDatabase(t);
  t.mock.method(PointEvent, 'create', async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); });
  const update = t.mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));

  assert.equal(await gamificationService.awardPoints(userId, 'report_created', referenceId), false);
  assert.equal(update.mock.calls.length, 0);
});

test('support removal deletes its event and decrements points without a negative balance', async (t) => {
  mockConnectedDatabase(t);
  t.mock.method(PointEvent, 'findOneAndDelete', async () => ({ points: 2, month: new Date().toISOString().slice(0, 7) }));
  const update = t.mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));

  assert.equal(await gamificationService.revokePoints(userId, 'support_received', referenceId), true);
  assert.equal(update.mock.calls.length, 1);
  const pipeline = update.mock.calls[0].arguments[1][0].$set;
  assert.equal(pipeline.totalPoints.$max[0], 0);
  assert.equal(pipeline.monthlyPoints.$cond[1].$max[0], 0);
});

test('leaderboard response exposes display names and points but never user identifiers or contacts', async (t) => {
  mockConnectedDatabase(t);
  t.mock.method(User, 'find', () => ({
    select() {
      return { lean: async () => [{
        _id: userId,
        name: 'Neighbour One',
        email: 'private@example.test',
        totalPoints: 15,
        monthlyPoints: 15,
        monthlyPointsMonth: new Date().toISOString().slice(0, 7),
        badges: [{ key: 'first_report' }]
      }] };
    }
  }));

  const rows = await gamificationService.getLeaderboard({ scope: 'month', viewerId: userId });
  assert.deepEqual(rows, [{ rank: 1, displayName: 'Neighbour One', points: 15, badgesCount: 1, isMe: true }]);
});

test('private impact stats include only the user’s own resolved photo comparisons', async (t) => {
  mockConnectedDatabase(t);
  const id = new mongoose.Types.ObjectId(userId);
  const complaintId = new mongoose.Types.ObjectId(referenceId);
  const monthlyPointsMonth = new Date().toISOString().slice(0, 7);
  t.mock.method(User, 'findById', () => ({
    select: () => ({ lean: async () => ({
      totalPoints: 125,
      monthlyPoints: 25,
      monthlyPointsMonth,
      badges: [{ key: 'first_report', label: 'First Report', awardedAt: new Date() }]
    }) })
  }));
  t.mock.method(Complaint, 'find', () => ({
    select() {
      return {
        sort() {
          return { lean: async () => [
            { _id: complaintId, title: 'Resolved report', status: 'resolved', beforeImages: [{ url: '/before.jpg' }], afterImages: [{ url: '/after.jpg' }] },
            { _id: new mongoose.Types.ObjectId(), title: 'Open report', status: 'submitted', beforeImages: [], afterImages: [] }
          ] };
        }
      };
    }
  }));
  t.mock.method(Drive, 'countDocuments', async (filter) => filter.$or ? 2 : 1);
  t.mock.method(User, 'countDocuments', async (filter) => filter.$expr ? 3 : 4);

  const stats = await gamificationService.getMyGamificationStats(id);
  assert.equal(stats.totalPoints, 125);
  assert.equal(stats.monthlyPoints, 25);
  assert.deepEqual(stats.rank, { monthly: 4, allTime: 5 });
  assert.equal(stats.reports, 2);
  assert.equal(stats.resolved, 1);
  assert.equal(stats.drivesJoined, 2);
  assert.equal(stats.drivesOrganized, 1);
  assert.deepEqual(stats.peopleImpactedEstimate, { value: 25, label: 'estimate' });
  assert.deepEqual(stats.beforeAfter, [{
    complaintId: String(complaintId),
    title: 'Resolved report',
    beforePhotoUrl: '/before.jpg',
    afterPhotoUrl: '/after.jpg'
  }]);
});

test('PointEvent enforces the required unique user, type, and reference index', () => {
  const uniqueIndex = PointEvent.schema.indexes().find(([keys, options]) => (
    keys.user === 1 && keys.type === 1 && keys.refId === 1 && options.unique
  ));
  assert.ok(uniqueIndex);
});

test('backfill rebuilds the same ledger idempotently and excludes self-support and creator joins', async (t) => {
  mockConnectedDatabase(t);
  const creatorId = new mongoose.Types.ObjectId('65f0c3123456789012345681');
  const joinerId = new mongoose.Types.ObjectId('65f0c3123456789012345682');
  const ownerId = new mongoose.Types.ObjectId('65f0c3123456789012345683');
  const supporterId = new mongoose.Types.ObjectId('65f0c3123456789012345684');
  const reportId = new mongoose.Types.ObjectId('65f0c3123456789012345685');
  const rejectedId = new mongoose.Types.ObjectId('65f0c3123456789012345686');
  const driveId = new mongoose.Types.ObjectId('65f0c3123456789012345687');
  const voteId = new mongoose.Types.ObjectId('65f0c3123456789012345688');
  const selfVoteId = new mongoose.Types.ObjectId('65f0c3123456789012345689');
  const createdAt = new Date('2026-10-01T00:00:00Z');
  const query = (result) => ({ select() { return this; }, populate() { return this; }, lean: async () => result });

  t.mock.method(PointEvent, 'init', async () => {});
  t.mock.method(PointEvent, 'deleteMany', async () => ({ deletedCount: 0 }));
  const insertMany = t.mock.method(PointEvent, 'insertMany', async (events) => events);
  t.mock.method(User, 'find', () => query([creatorId, joinerId, ownerId, supporterId].map((_id) => ({ _id }))));
  const bulkWrite = t.mock.method(User, 'bulkWrite', async () => ({ matchedCount: 4 }));
  t.mock.method(Complaint, 'find', () => query([
    { _id: reportId, createdBy: ownerId, status: 'resolved', completionVerification: { reviewDecision: 'approved' }, createdAt, resolvedAt: createdAt },
    { _id: rejectedId, createdBy: ownerId, status: 'rejected', completionVerification: { reviewDecision: 'rejected' }, createdAt }
  ]));
  t.mock.method(Drive, 'find', () => query([
    {
      _id: driveId,
      createdBy: creatorId,
      participants: [creatorId, joinerId, joinerId],
      participantHistory: [
        { user: joinerId, joinedAt: createdAt },
        { user: joinerId, joinedAt: new Date('2026-10-02T00:00:00Z') }
      ],
      createdAt
    }
  ]));
  t.mock.method(Vote, 'find', () => query([
    { _id: voteId, user: supporterId, complaint: { createdBy: ownerId }, createdAt },
    { _id: selfVoteId, user: ownerId, complaint: { createdBy: ownerId }, createdAt }
  ]));

  const firstRun = await gamificationService.rebuildGamificationData();
  const firstEvents = insertMany.mock.calls.flatMap((call) => call.arguments[0]);
  const secondRun = await gamificationService.rebuildGamificationData();
  const secondEvents = insertMany.mock.calls.slice(firstEvents.length ? 1 : 0)
    .flatMap((call) => call.arguments[0]);

  assert.deepEqual(firstRun, { users: 4, pointEvents: 6 });
  assert.deepEqual(secondRun, firstRun);
  assert.equal(firstEvents.length, 6);
  assert.equal(secondEvents.length, 6);
  assert.deepEqual(
    firstEvents.map(({ user, type, refId }) => `${user}:${type}:${refId}`).sort(),
    secondEvents.map(({ user, type, refId }) => `${user}:${type}:${refId}`).sort()
  );
  assert.equal(firstEvents.filter((event) => event.type === 'drive_joined').length, 1);
  assert.equal(firstEvents.filter((event) => event.type === 'support_received').length, 1);
  assert.equal(firstEvents.filter((event) => event.type === 'complaint_resolved').length, 1);
  assert.equal(firstEvents.find((event) => event.type === 'drive_joined').createdAt.toISOString(), createdAt.toISOString());
  assert.equal(bulkWrite.mock.calls.length, 2);
});
