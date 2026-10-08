import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../api/client.js';
import { getPublicOverdueComplaints } from '../api/public.js';
import PublicHeader from '../components/layout/PublicHeader.jsx';

function formatOverdue(milliseconds, t) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  if (minutes < 60) return t('overdue.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('overdue.hours', { count: hours });
  return t('overdue.days', { count: Math.floor(hours / 24) });
}

export default function OverdueComplaintsPage() {
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPublicOverdueComplaints()
      .then((items) => { if (active) setComplaints(items); })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, t('overdue.loadError'))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="public-page">
    <PublicHeader />
    <main className="public-content overdue-page">
      <section className="public-hero">
        <p className="eyebrow">{t('overdue.kicker')}</p>
        <h1>{t('overdue.title')}</h1>
        <p>{t('overdue.subtitle')}</p>
      </section>
      {error && <div className="notice-banner" role="alert">{error} <button onClick={() => window.location.reload()}>{t('overdue.retry')}</button></div>}
      {loading ? <div className="overdue-message" role="status">{t('overdue.loading')}</div>
        : complaints.length ? <div className="overdue-list">{complaints.map((complaint) => <article className="panel overdue-card" key={complaint._id}>
          <div className="overdue-card-heading"><div><p className="eyebrow">{t(`category.${complaint.category}`, { defaultValue: complaint.category?.replaceAll('_', ' ') || t('overdue.categoryFallback') })}</p><h2>{complaint.title}</h2></div><span className="overdue-level">{t(`overdue.level${complaint.escalationLevel}`)}</span></div>
          <div className="overdue-card-meta"><span>{t('overdue.reportedBy', { name: complaint.isAnonymous ? t('overdue.anonymous') : complaint.reporter?.name || t('overdue.reporter') })}</span><strong>{formatOverdue(complaint.timeOverdueMs, t)}</strong></div>
        </article>)}</div>
          : <div className="panel overdue-empty"><h2>{t('overdue.emptyTitle')}</h2><p>{t('overdue.emptyMessage')}</p></div>}
    </main>
  </div>;
}
