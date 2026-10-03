function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function publicTrackingUrl(complaintId) {
  const base = process.env.PUBLIC_APP_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}/track/${encodeURIComponent(String(complaintId))}`;
}

export function escapeEmailHtml(value) { return escapeHtml(value); }

export function renderNotificationEmail({ recipient, complaint, title, message }) {
  const safeName = escapeHtml(recipient?.name || 'StreetSetu user');
  const safeTitle = escapeHtml(title);
  const safeComplaintTitle = escapeHtml(complaint?.title || 'your complaint');
  const safeMessage = escapeHtml(message);
  const trackingUrl = escapeHtml(publicTrackingUrl(complaint?._id));
  return {
    subject: title,
    text: `Hello ${recipient?.name || 'StreetSetu user'},\n\n${message}\n\nTrack updates: ${publicTrackingUrl(complaint?._id)}\n\nStreetSetu`,
    html: `<!doctype html><html><body style="margin:0;background:#f3f7f1;font-family:Arial,sans-serif;color:#29483e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e1e9e1;border-radius:12px"><tr><td style="padding:28px"><p style="margin:0 0 18px;color:#648164;font-size:12px;font-weight:bold;letter-spacing:2px">STREETSETU</p><h1 style="font-size:22px;margin:0 0 14px">${safeTitle}</h1><p style="font-size:14px;line-height:1.7">Hello ${safeName},</p><p style="font-size:14px;line-height:1.7">${safeMessage}</p><p style="font-size:13px;color:#526b60"><strong>Complaint:</strong> ${safeComplaintTitle}</p><p style="margin:24px 0"><a href="${trackingUrl}" style="display:inline-block;border-radius:6px;background:#416d4d;color:#fff;padding:12px 18px;text-decoration:none;font-weight:bold">Track complaint</a></p><p style="font-size:11px;color:#87958d;line-height:1.6">This is an automated update from StreetSetu. Do not reply to this email.</p></td></tr></table></td></tr></table></body></html>`
  };
}
