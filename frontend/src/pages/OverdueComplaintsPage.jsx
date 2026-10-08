import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../api/client.js';
import { getPublicOverdueComplaints } from '../api/public.js';
import PublicHeader from '../components/layout/PublicHeader.jsx';

function formatOverdue(milliseconds) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  if (minutes < 60) return `${minutes} min overdue`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr overdue`;
  return `${Math.floor(hours / 24)} days overdue`;
}

export default function OverdueComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPublicOverdueComplaints()
      .then((items) => { if (active) setComplaints(items); })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Overdue complaints could not be loaded.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="public-page">
    <PublicHeader />
    <main className="public-content overdue-page">
      <section className="public-hero">
        <p className="eyebrow">Service accountability</p>
        <h1>Overdue complaints</h1>
        <p>Reports that have crossed their service deadline and been escalated for attention.</p>
      </section>
      {error && <div className="notice-banner" role="alert">{error} <button onClick={() => window.location.reload()}>Retry</button></div>}
      {loading ? <div className="overdue-message" role="status">Loading overdue reports…</div>
        : complaints.length ? <div className="overdue-list">{complaints.map((complaint) => <article className="panel overdue-card" key={complaint._id}>
          <div className="overdue-card-heading"><div><p className="eyebrow">{complaint.category?.replaceAll('_', ' ') || 'Civic report'}</p><h2>{complaint.title}</h2></div><span className="overdue-level">{complaint.escalationTarget}</span></div>
          <div className="overdue-card-meta"><span>Reported by {complaint.reporter?.name || (complaint.isAnonymous ? 'Anonymous' : 'Reporter')}</span><strong>{formatOverdue(complaint.timeOverdueMs)}</strong></div>
        </article>)}</div>
          : <div className="panel overdue-empty"><h2>No overdue complaints</h2><p>All currently tracked reports are within their service deadlines.</p></div>}
    </main>
  </div>;
}
