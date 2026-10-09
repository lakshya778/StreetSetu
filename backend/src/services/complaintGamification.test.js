import test from 'node:test';
import assert from 'node:assert/strict';
import AuditLog from '../models/AuditLog.js';
import Complaint from '../models/Complaint.js';
import DuplicateSupport from '../models/DuplicateSupport.js';
import Vote from '../models/Vote.js';
import gamificationService from './gamificationService.js';
import { removeVote, supportDuplicate } from './complaintService.js';

const complaintId = '65f0c3123456789012345678';
const ownerId = '65f0c3123456789012345679';
const supporterId = '65f0c3123456789012345680';
const voteId = '65f0c3123456789012345681';

function requestFor(userId) {
  return { user: { sub: userId, role: 'citizen' } };
}

function mockSupportStorage(t, { complaintOwner = ownerId, voteCreate } = {}) {
  t.mock.method(Complaint, 'findById', async () => ({ _id: complaintId, createdBy: complaintOwner, category: 'roads' }));
  t.mock.method(Vote, 'create', voteCreate || (async () => ({ _id: voteId })));
  t.mock.method(Vote, 'countDocuments', async () => 1);
  t.mock.method(DuplicateSupport, 'create', async () => ({}));
  t.mock.method(Complaint, 'updateOne', async () => ({ acknowledged: true }));
  t.mock.method(AuditLog, 'create', async () => ({}));
}

test('new support awards the complaint owner, but self-support does not', async (t) => {
  mockSupportStorage(t);
  const award = t.mock.method(gamificationService, 'awardPoints', async () => true);
  const result = await supportDuplicate(complaintId, requestFor(supporterId));

  assert.equal(result.supporterCount, 1);
  assert.deepEqual(award.mock.calls[0].arguments, [ownerId, 'support_received', voteId]);
});

test('self-support is recorded but does not award points', async (t) => {
  mockSupportStorage(t, { complaintOwner: supporterId });
  const award = t.mock.method(gamificationService, 'awardPoints', async () => true);

  await supportDuplicate(complaintId, requestFor(supporterId));
  assert.equal(award.mock.calls.length, 0);
});

test('an existing vote does not award support points again', async (t) => {
  mockSupportStorage(t, { voteCreate: async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); } });
  const award = t.mock.method(gamificationService, 'awardPoints', async () => true);

  await supportDuplicate(complaintId, requestFor(supporterId));
  assert.equal(award.mock.calls.length, 0);
});

test('removing a support vote revokes the owner points tied to that vote', async (t) => {
  mockSupportStorage(t);
  t.mock.method(Vote, 'findOneAndDelete', async () => ({ _id: voteId, user: supporterId }));
  const revoke = t.mock.method(gamificationService, 'revokePoints', async () => true);

  await removeVote(complaintId, requestFor(supporterId));
  assert.deepEqual(revoke.mock.calls[0].arguments, [ownerId, 'support_received', voteId]);
});
