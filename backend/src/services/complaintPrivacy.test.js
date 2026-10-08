import test from 'node:test';
import assert from 'node:assert/strict';
import { redactAssignmentReporters, redactComplaintReporter } from './complaintPrivacy.js';

const anonymousComplaint = {
  _id: 'complaint-1',
  isAnonymous: true,
  createdBy: { _id: 'reporter-1', name: 'A Citizen', email: 'citizen@example.test', phone: '123' },
  rejectedBy: { _id: 'reviewer-1', name: 'Admin' },
  statusHistory: [
    { status: 'submitted', changedBy: { _id: 'reporter-1', name: 'A Citizen', email: 'citizen@example.test' } },
    { status: 'under_review', changedBy: { _id: 'reviewer-1', name: 'Admin', email: 'admin@example.test' } }
  ]
};

test('anonymous reporter identity is hidden from public and volunteer complaint responses', () => {
  for (const req of [undefined, { user: { sub: 'volunteer-1', role: 'volunteer' } }]) {
    const result = redactComplaintReporter(anonymousComplaint, req);
    assert.deepEqual(result.createdBy, { name: 'Anonymous' });
    assert.deepEqual(result.statusHistory[0].changedBy, { name: 'Anonymous' });
    assert.equal(result.statusHistory[1].changedBy.email, 'admin@example.test');
    assert.deepEqual(result.rejectedBy, { _id: 'reviewer-1', name: 'Admin' });
    assert.equal(anonymousComplaint.createdBy.email, 'citizen@example.test');
  }
});

test('reporter and admin retain access to complaint reporter identity', () => {
  for (const req of [
    { user: { sub: 'reporter-1', role: 'citizen' } },
    { user: { sub: 'admin-1', role: 'admin' } }
  ]) {
    assert.equal(redactComplaintReporter(anonymousComplaint, req).createdBy.email, 'citizen@example.test');
  }
});

test('volunteer assignment payloads redact nested complaint reporter details', () => {
  const [assignment] = redactAssignmentReporters([{ _id: 'assignment-1', complaint: anonymousComplaint }], {
    user: { sub: 'volunteer-1', role: 'volunteer' }
  });
  assert.deepEqual(assignment.complaint.createdBy, { name: 'Anonymous' });
});

test('non-anonymous complaint identity remains limited to its reporter and admins', () => {
  const complaint = { ...anonymousComplaint, isAnonymous: false };
  assert.deepEqual(redactComplaintReporter(complaint, { user: { sub: 'volunteer-1', role: 'volunteer' } }).createdBy, { name: 'Reporter' });
  assert.equal(redactComplaintReporter(complaint, { user: { sub: 'reporter-1', role: 'citizen' } }).createdBy.email, 'citizen@example.test');
});
