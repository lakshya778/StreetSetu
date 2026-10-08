import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { getPublicComplaintTracking } from '../api/public.js';
import PublicHeader from '../components/layout/PublicHeader.jsx';
import { statusLabel } from '../components/complaints/ComplaintCard.jsx';

function formatDate(value, locale, fallback) {
  return value ? new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : fallback;
}

export default function PublicComplaintTrackingPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'hi' ? 'hi-IN' : 'en-IN';
  const { complaintId } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPublicComplaintTracking(complaintId).then((data) => { if (active) setComplaint(data); })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, t('tracking.invalidLink'))); });
    return () => { active = false; };
  }, [complaintId]);

  return <div className="public-page"><PublicHeader /><main className="public-content tracking-content">
    <Link className="back-link" to="/transparency">{t('tracking.back')}</Link>
    {error && <section className="panel public-error-panel"><h1>{t('tracking.notFound')}</h1><p>{error}</p></section>}
    {!error && !complaint && <div className="loading-state">{t('tracking.loading')}</div>}
    {complaint && <>
      <section className="panel tracking-summary"><p className="eyebrow">{t('tracking.kicker')}</p><h1>{complaint.title}</h1><p className="category-tag">{t(`category.${complaint.category}`, { defaultValue: complaint.category.replaceAll('_', ' ') })}</p><div className={`tracking-status status-${complaint.status}`}>{statusLabel(complaint.status)}</div><p className="tracking-created">{t('tracking.reported', { date: formatDate(complaint.createdAt, locale, t('tracking.timeUnavailable')) })}</p><p className="tracking-created">{t('tracking.reportedBy', { name: complaint.reporter?.name || t('tracking.reporter') })}</p>{complaint.assignedVolunteer && <div className="tracking-volunteer"><span>{t('tracking.assignedVolunteer')}</span><strong>{complaint.assignedVolunteer.name}</strong></div>}</section>
      <section className="panel tracking-timeline-panel"><div className="panel-heading"><div><p className="eyebrow">{t('tracking.serviceHistory')}</p><h2>{t('tracking.updates')}</h2></div></div>{complaint.timeline.length ? <ol className="tracking-timeline">{complaint.timeline.map((update, index) => <li key={`${update.changedAt}-${index}`}><span className="timeline-marker" /><div><strong>{statusLabel(update.status)}</strong><time>{formatDate(update.changedAt, locale, t('tracking.timeUnavailable'))}</time></div></li>)}</ol> : <p className="nearby-panel-message">{t('tracking.noUpdates')}</p>}</section>
    </>}
  </main></div>;
}
