import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { getComplaint, updateComplaintStatus } from '../api/complaints.js';
import { statusLabel } from '../components/complaints/ComplaintCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ComplaintDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => { let mounted = true; getComplaint(id).then((data) => { if (mounted) { setComplaint(data); setStatus(data.status); } }).catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'Complaint could not be loaded.')); }).finally(() => { if (mounted) setIsLoading(false); }); return () => { mounted = false; }; }, [id]);

  async function handleStatusUpdate(event) {
    event.preventDefault(); setIsUpdating(true); setError('');
    try { const updated = await updateComplaintStatus(id, { status, note }); setComplaint((current) => ({ ...current, ...updated })); setNote(''); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Status could not be updated.')); }
    finally { setIsUpdating(false); }
  }

  if (isLoading) return <div className="loading-state">Loading complaint...</div>;
  if (!complaint) return <div className="notice-banner">{error || 'Complaint not found.'} <button onClick={() => navigate('/dashboard/complaints')}>Return to complaints</button></div>;
  const canUpdate = user?.role === 'admin' || user?.role === 'volunteer';
  return <div className="details-page"><Link className="back-link" to="/dashboard/complaints">← Back to complaints</Link><div className="details-heading"><div><p className="eyebrow">Complaint detail</p><h1>{complaint.title}</h1><p className="page-lede">Reported {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div><span className={`detail-status status-${complaint.status}`}><i />{statusLabel(complaint.status)}</span></div>{error && <div className="notice-banner">{error}</div>}<div className="details-grid"><section className="panel detail-main"><div className="detail-tags"><span className={`priority-label priority-${complaint.priority}`}>{complaint.priority} priority</span><span className="category-tag">{complaint.category?.replaceAll('_', ' ')}</span></div><p className="detail-description">{complaint.description}</p>{complaint.address && <div className="location-block"><span>⌖</span><div><strong>{complaint.address}</strong><small>{complaint.latitude}, {complaint.longitude}</small></div></div>}{complaint.attachments?.length > 0 && <div className="evidence-grid">{complaint.attachments.map((attachment) => <img key={attachment.storageKey || attachment.url} src={attachment.url} alt={attachment.fileName || 'Complaint evidence'} />)}</div>}</section><aside className="panel history-panel"><div className="panel-heading"><div><p className="eyebrow">The paper trail</p><h2>Status history</h2></div></div><div className="timeline">{(complaint.statusHistory || []).slice().reverse().map((event, index) => <div className="timeline-item" key={`${event.status}-${event.changedAt}-${index}`}><span className={`timeline-dot ${index === 0 ? 'current' : ''}`} /><div><strong>{statusLabel(event.status)}</strong><small>{new Date(event.changedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>{event.note && <p>{event.note}</p>}</div></div>)}</div></aside></div>{canUpdate && <form className="panel status-form" onSubmit={handleStatusUpdate}><div><p className="eyebrow">Operations</p><h2>Update status</h2></div><div className="status-form-fields"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="under_review">Under review</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="rejected">Rejected</option></select><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note (optional)" /><button className="primary-button compact-button" disabled={isUpdating}>{isUpdating ? 'Saving...' : 'Save status'} <span>→</span></button></div></form>}</div>;
}
