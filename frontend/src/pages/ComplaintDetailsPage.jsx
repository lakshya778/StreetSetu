import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { checkComplaintDuplicates, getComplaint, submitComplaintFeedback, supportDuplicateComplaint, updateComplaintStatus } from '../api/complaints.js';
import { reviewCompletionVerification } from '../api/assignments.js';
import { statusLabel } from '../components/complaints/ComplaintCard.jsx';
import ImageGallery from '../components/media/ImageGallery.jsx';
import CompletionVerificationStatus from '../components/dashboard/CompletionVerificationStatus.jsx';
import ComplaintMap from '../components/maps/LazyComplaintMap.jsx';
import SkeletonList from '../components/layout/SkeletonList.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import PageHeader from '../components/layout/PageHeader.jsx';

const ADMIN_TRANSITIONS = {
  submitted: ['under_review', 'rejected'],
  under_review: ['rejected'],
  assigned: ['in_progress'],
  in_progress: [],
  needs_review: [],
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
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isReviewingCompletion, setIsReviewingCompletion] = useState(false);
  const [isSupporting, setIsSupporting] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [possibleDuplicates, setPossibleDuplicates] = useState([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicatesError, setDuplicatesError] = useState('');

  const loadComplaint = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    setComplaint(null);
    try {
      const data = await getComplaint(id);
      if (!data || typeof data !== 'object' || !data._id) throw new Error('Complaint details are unavailable.');
      setComplaint(data);
      setStatus(data.status || 'submitted');
    } catch (requestError) {
      setLoadError(getApiErrorMessage(requestError, 'Unable to load complaint details.'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadComplaint(); }, [loadComplaint]);

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
      const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
      setPossibleDuplicates(candidates.filter((candidate) => candidate?.complaint?._id && String(candidate.complaint._id) !== String(complaint._id)).slice(0, 5));
    }).catch((requestError) => {
      if (mounted) setDuplicatesError(getApiErrorMessage(requestError, 'Possible duplicate reports could not be checked.'));
    }).finally(() => { if (mounted) setDuplicatesLoading(false); });
    return () => { mounted = false; };
  }, [complaint?._id]);

  useEffect(() => {
    if (!socket) return undefined;
    const refreshComplaint = (event) => {
      if (event?.complaintId && event.complaintId !== id) return;
      getComplaint(id).then((updated) => {
        if (!updated?._id) return;
        setComplaint(updated);
        setStatus(updated.status || 'submitted');
      }).catch(() => {});
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
    if (complaint.status === 'assigned' && complaint.beforeImages?.length > 0) return ['in_progress'];
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
      setComplaint((current) => current ? ({ ...current, supporterCount: result?.supporterCount ?? current.supporterCount }) : current);
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

  async function handleCompletionReview(decision) {
    setIsReviewingCompletion(true);
    setError('');
    try {
      await reviewCompletionVerification(id, decision);
      await loadComplaint();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Completion evidence review could not be saved.'));
    } finally {
      setIsReviewingCompletion(false);
    }
  }

  if (isLoading) return <SkeletonList rows={3} variant="row" />;
  if (!complaint) return <section className="complaint-load-error" role="alert"><h1>Unable to load complaint details.</h1><p>{loadError || 'The complaint may be unavailable or you may not have access to it.'}</p><div><button type="button" className="primary-button compact-button" onClick={() => void loadComplaint()}>Retry</button><button type="button" className="outline-button" onClick={() => navigate('/dashboard/complaints', { replace: true })}>Back to complaints</button></div></section>;

  const history = Array.isArray(complaint.statusHistory) ? complaint.statusHistory.filter(Boolean) : [];
  const latestProof = history.slice().reverse().find((event) => event.captureSource);
  const canLeaveFeedback = user?.role === 'citizen'
    && String(complaint.createdBy?._id || complaint.createdBy) === String(user?._id)
    && ['resolved', 'closed'].includes(complaint.status)
    && (complaint.assignedVolunteer || complaint.assignedTo);
  const canReviewCompletion = user?.role === 'admin'
    && complaint.status === 'needs_review'
    && complaint.completionVerification?.verificationStatus === 'needs_review';
  const statusOptions = [complaint.status, ...availableTransitions.filter((nextStatus) => nextStatus !== complaint.status)];

  return (
    <div className="details-page">
      <Link className="back-link" to="/dashboard/complaints">← Back to complaints</Link>
      <PageHeader className="details-heading" kicker="Complaint detail" title={complaint.title || 'Complaint details'} subtitle={`Reported ${formatDate(complaint.createdAt, 'date')}`} actions={<span className={`detail-status status-${complaint.status}`}><i />{statusLabel(complaint.status)}</span>} />
      {error && <div className="notice-banner" role="alert">{error}</div>}
      <div className="details-grid">
        <section className="panel detail-main">
          <div className="detail-tags"><span className={`priority-label priority-${complaint.priority || 'medium'}`}>{complaint.priority || 'Normal'} priority</span><span className="category-tag">{displayCategory(complaint.category)}</span></div>
          <section className="ai-triage-card"><span className="ai-triage-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></svg></span><div><strong>AI-assisted triage</strong><p>Routing suggestions support the team; the report remains available for human review.</p></div></section>
          <div className="supporter-summary"><strong>{complaint.supporterCount ?? complaint.voteCount ?? 0}</strong> people support this complaint <button type="button" className="outline-button" onClick={handleSupport} disabled={isSupporting}>{isSupporting ? 'Adding support…' : 'Support this complaint'}</button></div>
          <p className="detail-description">{complaint.description}</p>
          {complaint.status === 'rejected' && <div className="rejection-reason-box"><strong>Rejection reason</strong><p>{complaint.rejectionReason || history.find((event) => event.status === 'rejected')?.note || 'No reason was recorded for this historical rejection.'}</p>{complaint.rejectedAt && <small>Rejected {new Date(complaint.rejectedAt).toLocaleString('en-IN')}</small>}</div>}
          {complaint.address && <div className="location-block"><span>⌖</span><div><strong>{complaint.address}</strong><small>{complaint.latitude}, {complaint.longitude}</small></div></div>}
          {Array.isArray(complaint.attachments) && complaint.attachments.length > 0 && <div className="complaint-evidence"><h2>Reported photos</h2><ImageGallery images={complaint.attachments} label="Reported complaint images" /></div>}
          <CompletionVerificationStatus verification={complaint.completionVerification} />
          {latestProof && <div className="completion-proof-trust">
            <p>{latestProof.captureSource === 'live_camera'
              ? `Photo taken at ${formatDate(latestProof.capturedAt, 'datetime')}, ${Number.isFinite(Number(latestProof.distance)) ? `${Math.round(Number(latestProof.distance))} m` : 'distance unavailable'} from reported spot`
              : `DEV gallery photo uploaded at ${formatDate(latestProof.changedAt, 'datetime')}`}</p>
            <span className={`status-badge ${complaint.completionVerification?.verificationStatus === 'verified' ? 'resolved-badge' : ''}`}>
              {latestProof.captureSource === 'live_camera' ? 'Verified live capture' : complaint.completionVerification?.verificationStatus === 'verified' ? 'Verified' : 'Needs review'}
            </span>
          </div>}
        </section>
        <aside className="panel history-panel">
          <div className="panel-heading"><div><p className="eyebrow">The paper trail</p><h2>Status history</h2></div></div>
          <div className="timeline">{history.slice().reverse().map((event, index) => (
            <div className="timeline-item" key={`${event.status || 'update'}-${event.changedAt || index}-${index}`}>
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
        {duplicatesLoading ? <div className="empty-table" role="status">Checking nearby reports…</div> : duplicatesError ? <div className="analytics-chart-error duplicate-check-error" role="status">{duplicatesError}</div> : possibleDuplicates.length ? <div className="possible-duplicate-list">{possibleDuplicates.map((entry, index) => {
          const candidate = entry?.complaint;
          if (!candidate?._id) return null;
          return <article className="possible-duplicate-row" key={candidate._id || index}><div><Link to={`/dashboard/complaints/${candidate._id}`}>{candidate.title || 'Untitled complaint'}</Link><span>{displayCategory(candidate.category)} · {statusLabel(candidate.status)}</span><small>{candidate.address || 'Address unavailable'}</small></div><div className="possible-duplicate-metrics"><strong>{Number.isFinite(Number(entry.confidence)) ? `${entry.confidence}% match` : 'Possible match'}</strong><span>{formatDistance(entry.distanceMeters)}</span></div></article>;
        })}</div> : <div className="empty-state compact-empty"><strong>No similar nearby reports found</strong><p>This report will remain visible with its own location marker.</p></div>}
      </section>
      {(complaint.beforeImages?.length > 0 || complaint.afterImages?.length > 0) && <section className="panel evidence-comparison"><div className="panel-heading"><div><p className="eyebrow">Field evidence</p><h2>Before and after</h2></div></div><div className="evidence-comparison-grid"><div><h3>Work started</h3><ImageGallery images={complaint.beforeImages} label="Before resolution images" /></div><div><h3>Work completed</h3><ImageGallery images={complaint.afterImages} label="After resolution images" /></div></div></section>}
      {canReviewCompletion && <section className="panel completion-manual-review"><div><p className="eyebrow">Admin review</p><h2>Completion evidence needs review</h2><p className="page-lede">Automated visual comparison is disabled. Review the work-start and completion photos before deciding.</p></div><div className="completion-manual-review-actions"><button type="button" className="primary-button compact-button" disabled={isReviewingCompletion} onClick={() => void handleCompletionReview('approve')}>{isReviewingCompletion ? 'Saving…' : 'Approve and resolve'}</button><button type="button" className="outline-button" disabled={isReviewingCompletion} onClick={() => void handleCompletionReview('reject')}>Reject evidence</button></div></section>}
      {canLeaveFeedback && <section className="panel citizen-feedback-panel"><div className="panel-heading"><div><p className="eyebrow">How did it go?</p><h2>Rate your volunteer</h2></div></div>{complaint.myFeedback ? <div className="feedback-confirmation"><div className="feedback-stars" aria-label={`${validRating(complaint.myFeedback.rating)} out of 5 stars`}>{'★'.repeat(validRating(complaint.myFeedback.rating))}<span>{'★'.repeat(5 - validRating(complaint.myFeedback.rating))}</span></div><p>Your feedback has been recorded. Thank you for helping improve community service.</p>{complaint.myFeedback.comment && <blockquote>{complaint.myFeedback.comment}</blockquote>}</div> : <form onSubmit={handleFeedbackSubmit}><div className="feedback-star-picker" role="group" aria-label="Rate your volunteer from one to five stars">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" className={rating <= feedbackRating ? 'is-selected' : ''} aria-label={`${rating} star${rating === 1 ? '' : 's'}`} aria-pressed={feedbackRating === rating} onClick={() => setFeedbackRating(rating)}>★</button>)}</div><label>Optional feedback<textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} maxLength={1000} rows={3} placeholder="Share a few words about your experience" /></label><div className="feedback-form-footer"><small>{feedbackComment.length}/1000</small><button className="primary-button compact-button" disabled={isSubmittingFeedback || feedbackRating === 0}>{isSubmittingFeedback ? 'Submitting...' : 'Submit feedback'}</button></div></form>}</section>}
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

function validRating(value) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 0;
}

function displayCategory(category) {
  return typeof category === 'string' && category ? category.replaceAll('_', ' ') : 'Category unavailable';
}

function formatDate(value, style) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'date unavailable';
  const options = style === 'datetime'
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : style === 'date'
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };
  return new Date(value).toLocaleString('en-IN', options);
}
