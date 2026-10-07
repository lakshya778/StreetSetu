import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/client.js';
import { getCompletionVerifications, reviewCompletionVerification } from '../../api/assignments.js';
import { useNotifications } from '../../context/NotificationContext.jsx';
import CompletionVerificationStatus from './CompletionVerificationStatus.jsx';

export default function CompletionVerificationPanel() {
  const { socket } = useNotifications();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getCompletionVerifications()); setError(''); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Completion verification records could not be loaded.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!socket) return undefined;
    socket.on('dashboard:updated', load);
    return () => socket.off('dashboard:updated', load);
  }, [socket, load]);

  async function review(complaintId, decision) {
    setActiveId(complaintId);
    setError('');
    try { await reviewCompletionVerification(complaintId, decision); await load(); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'The completion review could not be saved.')); }
    finally { setActiveId(''); }
  }

  const verified = useMemo(() => items.filter((item) => item.completionVerification?.verificationStatus === 'verified'), [items]);
  const needsReview = useMemo(() => items.filter((item) => item.completionVerification?.verificationStatus === 'needs_review'), [items]);
  const pending = useMemo(() => items.filter((item) => item.completionVerification?.verificationStatus === 'pending'), [items]);

  return <section className="panel completion-verification-panel">
    <div className="panel-heading"><div><p className="eyebrow">Field evidence integrity</p><h2>Completion verification review</h2></div><button className="outline-button" type="button" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <div className="notice-banner" role="alert">{error}<button type="button" onClick={load}>Retry</button></div>}
    {loading && !items.length ? <div className="loading-state">Loading verification records…</div> : <>
      <ReviewGroup title="Verified Work ✅" items={verified} empty="No work has passed automated verification yet." />
      <ReviewGroup title="Needs Review ⚠️" items={needsReview} empty="No completion evidence needs review." onApprove={(id) => review(id, 'approve')} onReject={(id) => review(id, 'reject')} activeId={activeId} />
      {pending.length > 0 && <ReviewGroup title="Processing" items={pending} empty="" />}
      {!items.length && !error && <div className="empty-state compact-empty"><strong>No completion checks yet</strong><p>Verification appears after a volunteer uploads before and after evidence.</p></div>}
    </>}
  </section>;
}

function ReviewGroup({ title, items, empty, onApprove, onReject, activeId }) {
  return <section className="completion-review-group"><div className="completion-review-heading"><h3>{title}</h3><span>{items.length}</span></div>
    {items.length ? <div className="completion-review-list">{items.map((item) => {
      const result = item.completionVerification || {};
      return <article className="completion-review-row" key={item._id}>
        <div className="completion-review-copy"><Link to={`/dashboard/complaints/${item._id}`}>{item.title}</Link><span>{item.category?.replaceAll('_', ' ')} ? {item.status?.replaceAll('_', ' ')} ? {item.assignedVolunteer?.name || item.assignedTo?.name || 'Volunteer unassigned'}</span><CompletionVerificationStatus verification={result} /></div>
        {(onApprove || onReject) && <div className="completion-review-actions"><button type="button" disabled={activeId === item._id} onClick={() => onApprove?.(item._id)}>{activeId === item._id ? 'Saving…' : 'Approve work'}</button><button type="button" className="outline-button" disabled={activeId === item._id} onClick={() => onReject?.(item._id)}>Keep under review</button></div>}
      </article>;
    })}</div> : <p className="completion-review-empty">{empty}</p>}
  </section>;
}
