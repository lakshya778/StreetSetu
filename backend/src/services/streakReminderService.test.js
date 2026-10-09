import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { sendWeeklyStreakReminders, streakReminderInternals } from './streakReminderService.js';

test('weekly reminders target only active streaks missing a report this ISO week', async (t) => {
  const users = [{ _id: 'user-one' }, { _id: 'user-two' }];
  let query;
  t.mock.method(User, 'find', (filter) => {
    query = filter;
    return {
      select() { return this; },
      lean() { return this; },
      [Symbol.asyncIterator]() { return users[Symbol.iterator](); }
    };
  });
  const created = t.mock.method(Notification, 'create', async (notification) => ({ toObject: () => notification }));
  const now = new Date('2026-10-12T04:00:00Z');

  const result = await sendWeeklyStreakReminders(now);
  assert.deepEqual(result, { week: streakReminderInternals.isoWeek(now), reminded: 2 });
  assert.deepEqual(query.lastReportWeek, streakReminderInternals.previousWeek(result.week));
  assert.deepEqual(query.streakWeeks, { $gt: 0 });
  assert.equal(query.isActive, true);
  assert.equal(created.mock.calls.length, 2);
  assert.ok(created.mock.calls.every(({ arguments: [notification] }) => notification.type === 'in_app' && !notification.complaint));
  assert.ok(created.mock.calls.every(({ arguments: [notification] }) => notification.dedupeKey.includes(result.week)));
});
