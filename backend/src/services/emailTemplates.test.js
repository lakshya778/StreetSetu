import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeEmailHtml, renderNotificationEmail } from './emailTemplates.js';

test('email template escapes user content and links to public complaint tracking', () => {
  const email = renderNotificationEmail({
    recipient: { name: '<Citizen>' },
    complaint: { _id: '507f1f77bcf86cd799439011', title: '<script>alert(1)</script>' },
    title: 'Complaint resolved',
    message: 'Issue updated'
  });
  assert.match(email.html, /&lt;Citizen&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /\/track\/507f1f77bcf86cd799439011/);
  assert.equal(escapeEmailHtml('& < >'), '&amp; &lt; &gt;');
});
