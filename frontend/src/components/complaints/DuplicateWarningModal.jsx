import { useEffect } from 'react';
import { statusLabel } from './ComplaintCard.jsx';

export default function DuplicateWarningModal({
  candidate,
  onSupport,
  onContinue,
  onReview,
  onBack,
  onClose,
  onViewComplaint,
  error = '',
  busy = false,
  supported = false
}) {
  useEffect(() => {
    if (!candidate) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busy) onClose?.();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [candidate, busy, onClose]);

  if (!candidate) return null;
  const distanceMeters = Number(candidate.distanceMeters);
  const distance = Number.isFinite(distanceMeters)
    ? distanceMeters < 1000 ? `${Math.round(distanceMeters)} m away` : `${(distanceMeters / 1000).toFixed(1)} km away`
    : 'Distance unavailable';
  const complaintId = candidate._id || candidate.complaint?._id;

  function closeOnBackdrop(event) {
    if (event.target === event.currentTarget && !busy) onClose?.();
  }

  return <div className="duplicate-modal-backdrop" role="presentation" onMouseDown={closeOnBackdrop}>
    <section className="duplicate-modal panel" role="dialog" aria-modal="true" aria-labelledby="duplicate-modal-title">
      <button type="button" className="duplicate-modal-close" aria-label="Close duplicate complaint dialog" onClick={onClose} disabled={busy}>×</button>
      <p className="eyebrow">Nearby report found</p>
      <h2 id="duplicate-modal-title">A similar complaint already exists nearby.</h2>
      <p className="page-lede">You can add your support to the existing report or submit a separate complaint.</p>
      <article className="duplicate-candidate">
        <div><strong>{candidate.title || candidate.complaint?.title || 'Nearby complaint'}</strong><span>{statusLabel(candidate.status || candidate.complaint?.status)}</span></div>
        <dl><div><dt>Distance</dt><dd>{distance}</dd></div><div><dt>Similarity</dt><dd>{Number.isFinite(Number(candidate.similarityScore)) ? `${candidate.similarityScore}%` : '—'}</dd></div><div><dt>Supporters</dt><dd>{candidate.supporterCount ?? 0}</dd></div></dl>
        {candidate.address && <p>{candidate.address}</p>}
      </article>
      {supported
        ? <p className="duplicate-supported-message" role="status">✓ Support added successfully</p>
        : <div className="duplicate-modal-actions">
            <button type="button" className="primary-button compact-button" disabled={busy || !complaintId} onClick={onSupport}>{busy ? 'Adding support…' : 'Support existing complaint'}</button>
            <button type="button" className="outline-button" disabled={busy} onClick={onContinue}>Continue submitting</button>
            <button type="button" className="text-button" disabled={busy} onClick={onReview}>Review my report</button>
          </div>}
      {error && <p className="duplicate-modal-error" role="alert">{error}</p>}
      {supported && <div className="duplicate-modal-actions duplicate-modal-actions-supported">
        <button type="button" className="primary-button compact-button" disabled={!complaintId} onClick={() => onViewComplaint?.(complaintId)}>View complaint</button>
        <button type="button" className="outline-button" disabled={busy} onClick={onContinue}>Continue submitting</button>
        <button type="button" className="text-button" disabled={busy} onClick={onBack}>Back</button>
      </div>}
      <div className="duplicate-modal-footer"><button type="button" className="outline-button" disabled={busy} onClick={onClose}>Close</button></div>
    </section>
  </div>;
}
