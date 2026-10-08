const PRESENTATIONS = {
  verified: { title: 'Verified Work', className: 'verification-verified' },
  pending: { title: 'Verification pending', className: 'verification-pending' },
  rejected: { title: 'Completion evidence rejected', className: 'verification-rejected' },
  unavailable: { title: 'Manual review required', className: 'verification-unavailable' },
  needs_review: { title: 'Needs Review', className: 'verification-needs_review' }
};

export default function CompletionVerificationStatus({ verification }) {
  if (!verification) return null;
  let state = verification.verificationStatus;
  if (verification.reviewDecision === 'rejected' || state === 'rejected') state = 'rejected';
  else if (state === 'verified') state = 'verified';
  else if (state === 'pending') state = 'pending';
  else if (/ai service unavailable|automated verification could not complete/i.test(verification.failureReason || '') || state === 'failed') state = 'unavailable';
  else if (state === 'needs_review') state = 'needs_review';
  else return null;

  const presentation = PRESENTATIONS[state];
  const detail = state === 'verified' || state === 'pending'
    ? null
    : state === 'rejected'
      ? verification.failureReason || 'Admin review rejected the completion evidence.'
      : state === 'unavailable'
        ? 'Automated verification could not complete. Please review the completion evidence manually.'
        : verification.failureReason || `Similarity ${verification.similarityScore ?? '—'}% · GPS ${verification.gpsMatched ? 'matched' : 'not verified'} · timestamps ${verification.timestampValid ? 'valid' : 'flagged'}`;

  return <div className={`completion-verification-inline ${presentation.className}`} role="status">
    <strong>{presentation.title}</strong>
    {detail && <span>{detail}</span>}
  </div>;
}
