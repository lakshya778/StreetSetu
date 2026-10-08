import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import Complaint from '../models/Complaint.js';
import { signToken } from '../config/jwt.js';
import adminRoutes from './adminRoutes.js';
import complaintRoutes from './complaintRoutes.js';

async function listen(t, app) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('overdue complaints route is public', async (t) => {
  t.mock.method(Complaint, 'find', () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => []
  }));
  const app = express();
  app.use('/api/v1/complaints', complaintRoutes);
  const baseUrl = await listen(t, app);
  const response = await fetch(`${baseUrl}/api/v1/complaints/overdue`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, []);
});

test('manual SLA escalation endpoint is admin-only', async (t) => {
  t.mock.method(Complaint, 'find', () => ({
    select() { return this; },
    lean: async () => []
  }));
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRoutes);
  const baseUrl = await listen(t, app);

  const unauthorized = await fetch(`${baseUrl}/api/v1/admin/escalation/run`, { method: 'POST' });
  assert.equal(unauthorized.status, 401);

  const citizen = await fetch(`${baseUrl}/api/v1/admin/escalation/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${signToken({ sub: 'citizen-1', role: 'citizen' })}` }
  });
  assert.equal(citizen.status, 403);

  const admin = await fetch(`${baseUrl}/api/v1/admin/escalation/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${signToken({ sub: 'admin-1', role: 'admin' })}` }
  });
  assert.equal(admin.status, 200);
  assert.equal((await admin.json()).data.escalated, 0);
});
