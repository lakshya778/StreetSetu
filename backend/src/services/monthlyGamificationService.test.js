import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import mongoose from 'mongoose';
import MonthlyGamificationClose from '../models/MonthlyGamificationClose.js';
import MonthlyWinner from '../models/MonthlyWinner.js';
import Notification from '../models/Notification.js';
import PointEvent from '../models/PointEvent.js';
import User from '../models/User.js';
import { signToken } from '../config/jwt.js';
import { errorHandler } from '../middleware/errorHandler.js';

const certificateDirectory = await mkdtemp(path.join(os.tmpdir(), 'streetsetu-certificates-'));
process.env.GAMIFICATION_CERTIFICATE_DIR = certificateDirectory;
const { closeMonth, monthlyGamificationInternals } = await import('./monthlyGamificationService.js');
const { default: adminRoutes } = await import('../routes/adminRoutes.js');
const MONTH = '2026-09';

test('monthly scheduler derives the previous IST month at the configured month boundary', () => {
  assert.equal(
    monthlyGamificationInternals.previousMonthInTimezone(new Date('2026-10-01T00:05:00+05:30'), 'Asia/Kolkata'),
    '2026-09'
  );
  assert.equal(monthlyGamificationInternals.monthBounds('2026-10').start.toISOString(), '2026-09-30T18:30:00.000Z');
});

test('month close rejects the current month so its leaderboard cannot reopen after reset', async () => {
  await assert.rejects(
    closeMonth(monthlyGamificationInternals.currentIstMonth()),
    { code: 'MONTH_NOT_COMPLETE', statusCode: 400 }
  );
});

function queryResult(result) {
  return { select() { return this; }, lean: async () => result };
}

function mockConnectedDatabase(t) {
  const previousState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;
  t.after(() => { mongoose.connection.readyState = previousState; });
}

test('month close creates top-three certificates once and admin close endpoint is safe to repeat', async (t) => {
  mockConnectedDatabase(t);
  t.after(async () => { await rm(certificateDirectory, { recursive: true, force: true }); });
  const users = [
    { _id: new mongoose.Types.ObjectId(), name: 'Asha' },
    { _id: new mongoose.Types.ObjectId(), name: 'Dev' },
    { _id: new mongoose.Types.ObjectId(), name: 'Mina' }
  ];
  let closure = null;
  const closureId = new mongoose.Types.ObjectId();
  t.mock.method(MonthlyGamificationClose, 'findOne', () => ({ lean: async () => closure }));
  t.mock.method(MonthlyGamificationClose, 'create', async (fields) => {
    closure = { ...fields, _id: closureId };
    return closure;
  });
  t.mock.method(MonthlyGamificationClose, 'updateOne', async (_filter, update) => {
    if (!closure || _filter.lockToken !== closure.lockToken) return { matchedCount: 0 };
    Object.assign(closure, update.$set);
    for (const key of Object.keys(update.$unset || {})) delete closure[key];
    return { matchedCount: 1 };
  });
  t.mock.method(PointEvent, 'aggregate', async () => users.map((user, index) => ({
    _id: user._id,
    points: 50 - index * 10
  })));
  t.mock.method(User, 'find', () => queryResult(users));
  const userUpdate = t.mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
  const resetUsers = t.mock.method(User, 'updateMany', async () => ({ matchedCount: users.length }));
  const savedWinners = new Map();
  t.mock.method(MonthlyWinner, 'findOneAndUpdate', async (filter, update) => {
    const saved = { _id: savedWinners.get(filter.rank) || new mongoose.Types.ObjectId(), ...filter, ...update.$set };
    savedWinners.set(filter.rank, saved._id);
    return saved;
  });
  const notifications = t.mock.method(Notification, 'create', async (document) => ({ toObject: () => document }));

  const firstResult = await closeMonth(MONTH);
  assert.deepEqual(firstResult.winners.map(({ rank, displayName, points }) => ({ rank, displayName, points })), [
    { rank: 1, displayName: 'Asha', points: 50 },
    { rank: 2, displayName: 'Dev', points: 40 },
    { rank: 3, displayName: 'Mina', points: 30 }
  ]);
  assert.equal(closure.status, 'closed');
  assert.equal(userUpdate.mock.calls.length, 3);
  assert.equal(resetUsers.mock.calls.length, 1);
  assert.equal(notifications.mock.calls.length, 3);
  assert.equal((await readdir(certificateDirectory)).filter((file) => file.endsWith('.pdf')).length, 3);

  const repeatedResult = await closeMonth(MONTH);
  assert.equal(repeatedResult.alreadyClosed, true);
  assert.equal(notifications.mock.calls.length, 3);

  const app = express();
  app.use('/api/v1/admin', adminRoutes);
  app.use(errorHandler);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/gamification/close-month?month=${MONTH}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${signToken({ sub: String(users[0]._id), role: 'admin' })}` }
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.alreadyClosed, true);
});
