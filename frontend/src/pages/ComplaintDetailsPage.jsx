import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { checkComplaintDuplicates, getComplaint, submitComplaintFeedback, supportDuplicateComplaint, updateComplaintStatus } from '../api/complaints.js';
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
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [possibleDuplicates, setPossibleDuplicates] = useState([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicatesError, setDuplicatesError] = useState('');

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
    if (!complaint?._id || !Number.isFinite(Number(complaint.latitude)) || !Number.isFinite(Number(complaint.longitude))) return undefined;
    let mounted = true;
    setDuplicatesLoading(true);
    setDuplicatesError('');
    checkComplaintDuplicates({
      title: complaint.title,
      description: complaint.description,
      category: complaint.category,
      latitude: Number(complaint.latitude),
      longitude: Number(complaint.longitude)
    }).then((result) => {
      if (!mounted) return;
      const candidates = result.candidates || [];
      setPossibleDuplicates(candidates.filter((candidate) => String(candidate.complaint?._id) !== String(complaint._id)).slice(0, 5));
    }).catch((requestError) => {
      if (mounted) setDuplicatesError(getApiErrorMessage(requestError, 'Possible duplicate reports could not be checked.'));
    }).finally(() => { if (mounted) setDuplicatesLoading(false); });
    return () => { mounted = false; };
  }, [complaint?._id]);

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

  async function handleFeedbackSubmit(event) {
    event.preventDefault();
    if (!Number.isInteger(feedbackRating) || feedbackRating < 1 || feedbackRating > 5) {
      setError('Choose a rating from 1 to 5 stars.');
      return;
    }
    setIsSubmittingFeedback(true);
    setError('');
    try {
      const feedback = await submitComplaintFeedback(id, { rating: feedbackRating, comment: feedbackComment.trim() });
      setComplaint((current) => ({ ...current, myFeedback: feedback }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Your feedback could not be submitted.'));
    } finally { setIsSubmittingFeedback(false); }
  }

  if (isLoading) return <div className="loading-state">Loading complaint...</div>;
  if (!complaint) return <div className="notice-banner">{error || 'Complaint not found.'} <button onClick={() => navigate('/dashboard/complaints')}>Return to complaints</button></div>;

  const history = complaint.statusHistory || [];
  const canLeaveFeedback = user?.role === 'citizen'
    && String(complaint.createdBy?._id || complaint.createdBy) === String(user?._id)
    && ['resolved', 'closed'].includes(complaint.status)
    && (complaint.assignedVolunteer || complaint.assignedTo);
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
      <section className="panel possible-duplicates-panel"><div className="panel-heading"><div><p className="eyebrow">Nearby reports</p><h2>Possible Duplicate Reports</h2><p className="page-lede">Reports are compared by category, description, title, and proximity.</p></div>{possibleDuplicates.length > 0 && <span className="duplicate-match-count">{possibleDuplicates.length} possible match{possibleDuplicates.length === 1 ? '' : 'es'}</span>}</div>
        {duplicatesLoading ? <div className="empty-table" role="status">Checking nearby reports…</div> : duplicatesError ? <div className="analytics-chart-error duplicate-check-error" role="status">{duplicatesError}</div> : possibleDuplicates.length ? <div className="possible-duplicate-list">{possibleDuplicates.map(({ complaint: candidate, confidence, distanceMeters }) => <article className="possible-duplicate-row" key={candidate._id}><div><Link to={`/dashboard/complaints/${candidate._id}`}>{candidate.title}</Link><span>{candidate.category?.replaceAll('_', ' ')} · {statusLabel(candidate.status)}</span><small>{candidate.address || 'Address unavailable'}</small></div><div className="possible-duplicate-metrics"><strong>{confidence}% match</strong><span>{formatDistance(distanceMeters)}</span></div></article>)}</div> : <div className="empty-state compact-empty"><strong>No similar nearby reports found</strong><p>This report will remain visible with its own location marker.</p></div>}
      </section>
      {(complaint.beforeImages?.length > 0 || complaint.afterImages?.length > 0) && <section className="panel evidence-comparison"><div className="panel-heading"><div><p className="eyebrow">Field evidence</p><h2>Before and after</h2></div></div><div className="evidence-comparison-grid"><div><h3>Work started</h3><ImageGallery images={complaint.beforeImages} label="Before resolution images" /></div><div><h3>Work completed</h3><ImageGallery images={complaint.afterImages} label="After resolution images" /></div></div></section>}
      {canLeaveFeedback && <section className="panel citizen-feedback-panel"><div className="panel-heading"><div><p className="eyebrow">How did it go?</p><h2>Rate your volunteer</h2></div></div>{complaint.myFeedback ? <div className="feedback-confirmation"><div className="feedback-stars" aria-label={`${complaint.myFeedback.rating} out of 5 stars`}>{'★'.repeat(complaint.myFeedback.rating)}<span>{'★'.repeat(5 - complaint.myFeedback.rating)}</span></div><p>Your feedback has been recorded. Thank you for helping improve community service.</p>{complaint.myFeedback.comment && <blockquote>{complaint.myFeedback.comment}</blockquote>}</div> : <form onSubmit={handleFeedbackSubmit}><div className="feedback-star-picker" role="group" aria-label="Rate your volunteer from one to five stars">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" className={rating <= feedbackRating ? 'is-selected' : ''} aria-label={`${rating} star${rating === 1 ? '' : 's'}`} aria-pressed={feedbackRating === rating} onClick={() => setFeedbackRating(rating)}>★</button>)}</div><label>Optional feedback<textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} maxLength={1000} rows={3} placeholder="Share a few words about your experience" /></label><div className="feedback-form-footer"><small>{feedbackComment.length}/1000</small><button className="primary-button compact-button" disabled={isSubmittingFeedback || feedbackRating === 0}>{isSubmittingFeedback ? 'Submitting...' : 'Submit feedback'}</button></div></form>}</section>}
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

function formatDistance(meters) {
  const distance = Number(meters);
  if (!Number.isFinite(distance)) return 'Distance unavailable';
  return distance < 1000 ? `${Math.round(distance)} m away` : `${(distance / 1000).toFixed(1)} km away`;
}
