import { useState } from 'react';

const galleryProofEnabled = import.meta.env.DEV === true
  && import.meta.env.VITE_ALLOW_GALLERY_PROOF === 'true';

export default function DevGalleryProof({ disabled = false, onSubmit }) {
  const [file, setFile] = useState(null);
  if (!galleryProofEnabled) return null;

  // TODO(remove-before-submission): delete this component and its VolunteerDashboardPage.jsx wiring; remove dev_gallery handling from backend/src/services/workEvidenceService.js and backend/src/services/completionVerificationService.js, then remove its env/docs entries.
  return <div className="dev-gallery-proof">
    <p className="dev-gallery-banner">DEV MODE: gallery upload enabled</p>
    <label>
      Choose a local proof image
      <input
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={(event) => setFile(event.target.files?.[0] || null)}
      />
    </label>
    {file && <div className="capture-actions">
      <span>{file.name}</span>
      <button
        type="button"
        className="assignment-action evidence-submit-button"
        disabled={disabled}
        onClick={() => onSubmit(file, { captureSource: 'dev_gallery' })}
      >
        {disabled ? 'Saving…' : 'Upload DEV gallery proof'}
      </button>
    </div>}
  </div>;
}
