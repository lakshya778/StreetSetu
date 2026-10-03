import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { getComplaint, supportDuplicateComplaint, updateComplaintStatus } from '../api/complaints.js';
import { statusLabel } from '../components/complaints/ComplaintCard.jsx';
import ImageGallery from '../components/media/ImageGallery.jsx';
import ComplaintMap from '../components/maps/ComplaintMap.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

const ADMIN_TRANSITIONS = {
  submitted: ['under_review', 'rejected'],
  under_review: ['rejected'],
  assigned: ['in_progress'],
  in_progress: ['resolved'],
  resolved: ['closed'],
  closed: [],
  rejected: []
};

export default function ComplaintDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useNotifications();
  const [complaint, setComplaint] = useState(null);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSupporting, setIsSupporting] = useState(false);

  useEffect(() => {
    let mounted = true;
    getComplaint(id)
      .then((data) => {
        if (mounted) {
          setComplaint(data);
          setStatus(data.status);
        }
      })
      .catch((requestError) => {
        if (mounted) setError(getApiErrorMessage(requestError, 'Complaint could not be loaded.'));
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    if (!socket) return undefined;
    const refreshComplaint = (event) => {
      if (event?.complaintId && event.complaintId !== id) return;
      getComplaint(id).then((updated) => { setComplaint(updated); setStatus(updated.status); }).catch(() => {});
    };
    socket.emit('complaint:join', id);
    socket.on('complaint:status', refreshComplaint);
    socket.on('complaint:assigned', refreshComplaint);
    socket.on('complaint:reassigned', refreshComplaint);
    socket.on('complaint:rejected', refreshComplaint);
    return () => {
      socket.off('complaint:status', refreshComplaint);
      socket.off('complaint:assigned', refreshComplaint);
      socket.off('complaint:reassigned', refreshComplaint);
      socket.off('complaint:rejected', refreshComplaint);
    };
  }, [id, socket]);

  const canUpdate = user?.role === 'admin' || user?.role === 'volunteer';
  const availableTransitions = useMemo(() => {
    if (!complaint || !canUpdate) return [];
    if (user.role === 'admin') return ADMIN_TRANSITIONS[complaint.status] || [];
    if (complaint.status === 'assigned') return ['in_progress'];
    if (complaint.status === 'in_progress') return ['resolved'];
    return [];
  }, [canUpdate, complaint, user?.role]);

  async function handleStatusUpdate(event) {
    event.preventDefault();
    if (status === 'rejected' && !note.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    setIsUpdating(true);
    setError('');
    try {
      const updated = await updateComplaintStatus(id, { status, note: note.trim() });
      setComplaint((current) => ({ ...current, ...updated }));
      setStatus(updated.status);
      setNote('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Status could not be updated.'));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleSupport() {
    setIsSupporting(true);
    try {
      const result = await supportDuplicateComplaint(id);
      setComplaint((current) => ({ ...current, supporterCount: result.supporterCount }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Your support could not be added.'));
    } finally { setIsSupporting(false); }
  }

  if (isLoading) return <div className="loading-state">Loading complaint...</div>;
  if (!complaint) return <div className="notice-banner">{error || 'Complaint not found.'} <button onClick={() => navigate('/dashboard/complaints')}>Return to complaints</button></div>;

  const history = complaint.statusHistory || [];
  const statusOptions = [complaint.status, ...availableTransitions.filter((nextStatus) => nextStatus !== complaint.status)];

  return (
    <div className="details-page">
      <Link className="back-link" to="/dashboard/complaints">← Back to complaints</Link>
      <div className="details-heading">
        <div>
          <p className="eyebrow">Complaint detail</p>
          <h1>{complaint.title}</h1>
          <p className="page-lede">Reported {new Date(complaint.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <span className={`detail-status status-${complaint.status}`}><i />{statusLabel(complaint.status)}</span>
      </div>
      {error && <div className="notice-banner" role="alert">{error}</div>}
      <div className="details-grid">
        <section className="panel detail-main">
          <div className="detail-tags"><span className={`priority-label priority-${complaint.priority}`}>{complaint.priority} priority</span><span className="category-tag">{complaint.category?.replaceAll('_', ' ')}</span></div>
          <div className="supporter-summary"><strong>{complaint.supporterCount ?? complaint.voteCount ?? 0}</strong> people support this complaint <button type="button" className="outline-button" onClick={handleSupport} disabled={isSupporting}>{isSupporting ? 'Adding support…' : 'Support this complaint'}</button></div>
          <p className="detail-description">{complaint.description}</p>
          {complaint.status === 'rejected' && <div className="rejection-reason-box"><strong>Rejection reason</strong><p>{complaint.rejectionReason || history.find((event) => event.status === 'rejected')?.note || 'No reason was recorded for this historical rejection.'}</p>{complaint.rejectedAt && <small>Rejected {new Date(complaint.rejectedAt).toLocaleString('en-IN')}</small>}</div>}
          {complaint.address && <div className="location-block"><span>⌖</span><div><strong>{complaint.address}</strong><small>{complaint.latitude}, {complaint.longitude}</small></div></div>}
          {complaint.attachments?.length > 0 && <div className="complaint-evidence"><h2>Reported photos</h2><ImageGallery images={complaint.attachments} label="Reported complaint images" /></div>}
        </section>
        <aside className="panel history-panel">
          <div className="panel-heading"><div><p className="eyebrow">The paper trail</p><h2>Status history</h2></div></div>
          <div className="timeline">{history.slice().reverse().map((event, index) => (
            <div className="timeline-item" key={`${event.status}-${event.changedAt}-${index}`}>
              <span className={`timeline-dot ${index === 0 ? 'current' : ''}`} />
              <div>
                <strong>{event.previousStatus ? `${statusLabel(event.previousStatus)} → ${statusLabel(event.status)}` : statusLabel(event.status)}</strong>
                <small>{event.changedBy?.name ? `${event.changedBy.name} · ` : ''}{new Date(event.changedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>
                {event.note && <p>{event.note}</p>}
              </div>
            </div>
          ))}</div>
        </aside>
      </div>
      <section className="complaint-detail-location"><div className="panel-heading"><div><p className="eyebrow">Location</p><h2>{complaint.address || 'Reported location'}</h2></div><span className="coordinate-label">{complaint.latitude}, {complaint.longitude}</span></div><ComplaintMap complaints={[complaint]} className="complaint-detail-map" /></section>
      {(complaint.beforeImages?.length > 0 || complaint.afterImages?.length > 0) && <section className="panel evidence-comparison"><div className="panel-heading"><div><p className="eyebrow">Field evidence</p><h2>Before and after</h2></div></div><div className="evidence-comparison-grid"><div><h3>Work started</h3><ImageGallery images={complaint.beforeImages} label="Before resolution images" /></div><div><h3>Work completed</h3><ImageGallery images={complaint.afterImages} label="After resolution images" /></div></div></section>}
      {canUpdate && availableTransitions.length > 0 && <form className="panel status-form" onSubmit={handleStatusUpdate}>
        <div><p className="eyebrow">Operations</p><h2>Update status</h2></div>
        <div className="status-form-fields">
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="New complaint status">
            {statusOptions.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}
          </select>
          <label className="status-note-field">
            {status === 'rejected' ? 'Rejection reason (required)' : 'Note (optional)'}
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={status === 'rejected' ? 'Explain why this complaint is rejected' : 'Add a status note'} required={status === 'rejected'} maxLength={1000} />
          </label>
          <button className="primary-button compact-button" disabled={isUpdating || status === complaint.status}>{isUpdating ? 'Saving...' : 'Save status'} <span>→</span></button>
        </div>
      </form>}
    </div>
  );
}
