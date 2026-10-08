import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import i18n from '../../i18n/index.js';

const statusLabels = {
  submitted: 'Submitted', under_review: 'Under review', assigned: 'Assigned',
  in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed', rejected: 'Rejected'
};

export function statusLabel(status) {
  return i18n.t(`status.${status}`, { defaultValue: statusLabels[status] || status?.replaceAll('_', ' ') || 'Unknown' });
}

function thumbnailUrl(image) {
  const originalUrl = image?.url || image?.src;
  if (!originalUrl) return '';
  try {
    const url = new URL(originalUrl);
    if (url.hostname.endsWith('res.cloudinary.com')) {
      url.pathname = url.pathname.replace('/upload/', '/upload/w_400,q_auto,f_auto/');
      return url.toString();
    }
  } catch {
    return originalUrl;
  }
  return originalUrl;
}

function timeAgo(value, locale) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const units = [[31536000, 'year'], [2592000, 'month'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
  const [seconds, unit] = units.find(([seconds]) => elapsedSeconds >= seconds) || [1, 'second'];
  const amount = Math.floor(elapsedSeconds / seconds);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-amount, unit);
}

export default function ComplaintCard({ complaint }) {
  const { t, i18n } = useTranslation();
  const thumbnail = thumbnailUrl(complaint.attachments?.[0]);
  const locale = i18n.resolvedLanguage === 'hi' ? 'hi-IN' : 'en-IN';
  return (
    <Link to={`/dashboard/complaints/${complaint._id}`} className="complaint-card">
      {thumbnail && <img className="complaint-card-thumbnail" src={thumbnail} alt="" loading="lazy" decoding="async" width="400" height="300" />}
      <div className="complaint-card-top">
        <span className={`status-dot status-${complaint.status}`} />
        <span className="complaint-status">{statusLabel(complaint.status)}</span>
        <span className={`priority-label priority-${complaint.priority}`}>{t(`priority.${complaint.priority}`, { defaultValue: complaint.priority })}</span>
      </div>
      <h3>{complaint.title}</h3>
      <p>{complaint.description}</p>
      {complaint.address && <span className="complaint-card-location"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>{complaint.address}</span>}
      <div className="complaint-card-meta">
        <span>{t(`category.${complaint.category}`, { defaultValue: complaint.category?.replaceAll('_', ' ') })}</span>
        <span>{timeAgo(complaint.createdAt, locale)}</span>
      </div>
      <div className="complaint-card-support"><span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>{complaint.supporterCount ?? complaint.voteCount ?? 0} {t('complaints.supporting')}</span><span>{t('complaints.viewReport')} <b aria-hidden="true">→</b></span></div>
    </Link>
  );
}
