import { useState } from 'react';

const galleryProofEnabled = import.meta.env.DEV === true
  && import.meta.env.VITE_ALLOW_GALLERY_PROOF === 'true';

export default function DevGalleryProof({
  disabled = false,
  onSubmit,
  chooseLabel = 'Choose a local proof image',
  submitLabel = 'Upload DEV gallery proof',
  bannerLabel = 'DEV MODE: gallery upload enabled'
}) {
  const [file, setFile] = useState(null);
  if (!galleryProofEnabled) return null;

  // TODO(remove-before-submission): remove this component and its CreateComplaintPage.jsx/VolunteerDashboardPage.jsx wiring, plus backend dev_gallery handling and env/docs entries.
  return <div className="dev-gallery-proof">
    <p className="dev-gallery-banner">{bannerLabel}</p>
    <label>
      {chooseLabel}
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
        {disabled ? 'Saving…' : submitLabel}
      </button>
    </div>}
  </div>;
}
