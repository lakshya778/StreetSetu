import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { getPublicComplaintTracking } from '../api/public.js';
import PublicHeader from '../components/layout/PublicHeader.jsx';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Update time unavailable';
}

export default function PublicComplaintTrackingPage() {
  const { complaintId } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPublicComplaintTracking(complaintId).then((data) => { if (active) setComplaint(data); })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'This tracking link is invalid or unavailable.')); });
    return () => { active = false; };
  }, [complaintId]);

  return <div className="public-page"><PublicHeader /><main className="public-content tracking-content">
    <Link className="back-link" to="/transparency">← Public transparency</Link>
    {error && <section className="panel public-error-panel"><h1>Complaint not found</h1><p>{error}</p></section>}
    {!error && !complaint && <div className="loading-state">Loading complaint updates…</div>}
    {complaint && <>
      <section className="panel tracking-summary"><p className="eyebrow">Public complaint tracking</p><h1>{complaint.title}</h1><p className="category-tag">{complaint.category.replaceAll('_', ' ')}</p><div className={`tracking-status status-${complaint.status}`}>{complaint.status.replaceAll('_', ' ')}</div><p className="tracking-created">Reported {formatDate(complaint.createdAt)}</p>{complaint.assignedVolunteer && <div className="tracking-volunteer"><span>Assigned volunteer</span><strong>{complaint.assignedVolunteer.name}</strong></div>}</section>
      <section className="panel tracking-timeline-panel"><div className="panel-heading"><div><p className="eyebrow">Service history</p><h2>Updates</h2></div></div>{complaint.timeline.length ? <ol className="tracking-timeline">{complaint.timeline.map((update, index) => <li key={`${update.changedAt}-${index}`}><span className="timeline-marker" /><div><strong>{update.status.replaceAll('_', ' ')}</strong><time>{formatDate(update.changedAt)}</time></div></li>)}</ol> : <p className="nearby-panel-message">No status updates are available yet.</p>}</section>
    </>}
  </main></div>;
}
