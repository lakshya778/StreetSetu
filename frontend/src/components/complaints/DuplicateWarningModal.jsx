import { statusLabel } from './ComplaintCard.jsx';

export default function DuplicateWarningModal({ candidate, onSupport, onContinue, onCancel, busy = false, supported = false }) {
  if (!candidate) return null;
  const distance = candidate.distanceMeters < 1000
    ? `${candidate.distanceMeters} m away`
    : `${(candidate.distanceMeters / 1000).toFixed(1)} km away`;
  return <div className="duplicate-modal-backdrop" role="presentation">
    <section className="duplicate-modal panel" role="dialog" aria-modal="true" aria-labelledby="duplicate-modal-title">
      <p className="eyebrow">Nearby report found</p>
      <h2 id="duplicate-modal-title">A similar complaint already exists nearby.</h2>
      <p className="page-lede">You can add your support to the existing report or submit a separate complaint.</p>
      <article className="duplicate-candidate">
        <div><strong>{candidate.title}</strong><span>{statusLabel(candidate.status)}</span></div>
        <dl><div><dt>Distance</dt><dd>{distance}</dd></div><div><dt>Similarity</dt><dd>{candidate.similarityScore}%</dd></div><div><dt>Supporters</dt><dd>{candidate.supporterCount || 0}</dd></div></dl>
        {candidate.address && <p>{candidate.address}</p>}
      </article>
      {supported && <p className="duplicate-supported-message" role="status">You’re now supporting this existing complaint.</p>}
      <div className="duplicate-modal-actions">
        <button type="button" className="primary-button compact-button" disabled={busy || supported} onClick={onSupport}>{supported ? 'Support added' : busy ? 'Adding support…' : 'Support existing complaint'}</button>
        <button type="button" className="outline-button" disabled={busy || supported} onClick={onContinue}>Continue submitting</button>
        <button type="button" className="text-button" disabled={busy} onClick={onCancel}>Review my report</button>
      </div>
    </section>
  </div>;
}
