import test from 'node:test';
import assert from 'node:assert/strict';
import Complaint from '../models/Complaint.js';
import {
  buildSlaDeadline,
  escalationLevelName,
  listOverdueComplaints,
  runSlaEscalation
} from './escalationService.js';

async function withEnv(values, action) {
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])));
  try { return await action(); }
  finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('SLA deadline uses configured priority durations and medium fallback', async () => {
  await withEnv({ SLA_HIGH_MINUTES: 1, SLA_MEDIUM_MINUTES: 2, SLA_LOW_MINUTES: 3 }, () => {
    const start = new Date('2026-10-08T00:00:00Z');
    assert.equal(buildSlaDeadline('high', start).getTime() - start.getTime(), 60000);
    assert.equal(buildSlaDeadline('critical', start).getTime() - start.getTime(), 60000);
    assert.equal(buildSlaDeadline(undefined, start).getTime() - start.getTime(), 120000);
    assert.equal(buildSlaDeadline('low', start).getTime() - start.getTime(), 180000);
  });
});

test('escalation levels map to Ward Officer, Zonal Officer, and Commissioner', () => {
  assert.equal(escalationLevelName(1), 'Ward Officer');
  assert.equal(escalationLevelName(2), 'Zonal Officer');
  assert.equal(escalationLevelName(3), 'Commissioner');
});

test('due complaints escalate atomically once and record history and notification', async (t) => {
  await withEnv({ SLA_HIGH_MINUTES: 1 }, async () => {
    const now = new Date('2026-10-08T00:02:00Z');
    const initialDeadline = new Date('2026-10-08T00:01:00Z');
    const state = {
      _id: 'complaint-1',
      title: 'Road damage',
      status: 'submitted',
      priority: 'high',
      createdBy: 'citizen-1',
      slaDeadline: initialDeadline,
      escalationLevel: 0,
      statusHistory: []
    };
    t.mock.method(Complaint, 'find', (filter) => {
      assert.deepEqual(filter.status, { $nin: ['resolved', 'closed', 'rejected'] });
      assert.deepEqual(filter.slaDeadline, { $lte: now });
      assert.deepEqual(filter.escalationLevel, { $lt: 3 });
      return { select() { return this; }, lean: async () => (state.slaDeadline <= now && state.escalationLevel < 3 ? [{ ...state }] : []) };
    });
    t.mock.method(Complaint, 'findOneAndUpdate', (filter, update, options) => {
      assert.deepEqual(filter, {
        _id: 'complaint-1',
        status: { $nin: ['resolved', 'closed', 'rejected'] },
        slaDeadline: { $lte: now },
        escalationLevel: state.escalationLevel
      });
      assert.equal(options.runValidators, true);
      state.slaDeadline = update.$set.slaDeadline;
      Object.assign(state, update.$set);
      state.statusHistory.push(update.$push.statusHistory);
      return { lean: async () => ({ ...state }) };
    });
    const notifications = [];
    const firstRun = await runSlaEscalation({ now, notify: async (notification) => notifications.push(notification) });
    const secondRun = await runSlaEscalation({ now, notify: async (notification) => notifications.push(notification) });

    assert.equal(firstRun.escalated, 1);
    assert.equal(firstRun.items[0].levelName, 'Ward Officer');
    assert.equal(state.escalationLevel, 1);
    assert.equal(state.isOverdue, true);
    assert.equal(state.overdueSince, initialDeadline);
    assert.equal(state.slaDeadline.getTime(), now.getTime() + 60000);
    assert.equal(state.statusHistory[0].eventType, 'sla_escalated');
    assert.equal(state.statusHistory[0].changedBy, undefined);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].levelName, 'Ward Officer');
    assert.equal(secondRun.escalated, 0);
  });
});

test('overdue listing exposes escalation display data without reporter identifiers', async (t) => {
  const overdueSince = new Date('2026-10-08T00:00:00Z');
  const now = new Date('2026-10-08T00:05:00Z');
  t.mock.method(Complaint, 'find', (filter) => {
    assert.equal(filter.isOverdue, true);
    assert.deepEqual(filter.status, { $nin: ['resolved', 'closed', 'rejected'] });
    return {
      select() { return this; },
      sort() { return this; },
      lean: async () => [{
        _id: 'complaint-2',
        title: 'Open drain',
        category: 'drainage',
        status: 'in_progress',
        isAnonymous: true,
        escalationLevel: 2,
        overdueSince
      }]
    };
  });
  const [item] = await listOverdueComplaints(now);
  assert.equal(item.escalationTarget, 'Zonal Officer');
  assert.equal(item.reporter.name, 'Anonymous');
  assert.equal(item.timeOverdueMs, 300000);
  assert.equal(Object.hasOwn(item, 'createdBy'), false);
});

test('SLA status history permits system escalation events without a user actor', async () => {
  const complaint = new Complaint({
    title: 'Road damage',
    description: 'A broken road surface needs repair.',
    category: 'roads',
    location: { type: 'Point', coordinates: [77.2, 28.6] },
    longitude: 77.2,
    latitude: 28.6,
    createdBy: '65f0c3123456789012345678',
    statusHistory: [{ eventType: 'sla_escalated', status: 'submitted', note: 'Escalated' }]
  });
  await complaint.validate();
});
