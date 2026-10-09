import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { checkComplaintDuplicates, classifyComplaint, complaintCategories, createComplaint, complaintPriorities, supportDuplicateComplaint, uploadComplaintImages } from '../api/complaints.js';
import LiveCameraCapture from '../components/media/LiveCameraCapture.jsx';
import DevGalleryProof from '../components/media/DevGalleryProof.jsx';
import DuplicateWarningModal from '../components/complaints/DuplicateWarningModal.jsx';
import LocationPicker from '../components/maps/LocationPicker.jsx';
import PageHeader from '../components/layout/PageHeader.jsx';
import NearbyComplaintsPanel from '../components/complaints/NearbyComplaintsPanel.jsx';
import { reverseGeocode } from '../api/locations.js';
import reportTips from '../data/reportTips.json';

const initialForm = { title: '', description: '', category: 'roads', priority: 'medium', isAnonymous: false, latitude: '', longitude: '', address: '', city: '', area: '' };
let nextEducationalTip = 0;

function distanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
}

export default function CreateComplaintPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [classification, setClassification] = useState(null);
  const [createdComplaint, setCreatedComplaint] = useState(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [showEducationalTip, setShowEducationalTip] = useState(false);
  const [duplicateCandidate, setDuplicateCandidate] = useState(null);
  const [duplicateSupported, setDuplicateSupported] = useState(false);
  const [cameraCaptureKey, setCameraCaptureKey] = useState(0);
  const [galleryCaptureKey, setGalleryCaptureKey] = useState(0);
  const [locationMismatchConfirmed, setLocationMismatchConfirmed] = useState(false);
  const locationSelectionRef = useRef(0);
  const photoPreviews = useMemo(() => photos.map((photo) => ({
    ...photo,
    previewUrl: URL.createObjectURL(photo.file)
  })), [photos]);

  useEffect(() => () => photoPreviews.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), [photoPreviews]);

  function updateField(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }

  function updateLocation({ latitude, longitude, address, city = '', area = '' }) {
    locationSelectionRef.current += 1;
    setLocationMismatchConfirmed(false);
    setForm((current) => ({ ...current, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6), address, city, area }));
  }

  async function selectFirstPhotoLocation(metadata) {
    const requestId = ++locationSelectionRef.current;
    setLocationMismatchConfirmed(false);
    const coordinates = {
      latitude: metadata.latitude,
      longitude: metadata.longitude
    };
    setForm((current) => ({
      ...current,
      latitude: coordinates.latitude.toFixed(6),
      longitude: coordinates.longitude.toFixed(6),
      address: '',
      city: '',
      area: ''
    }));
    try {
      const address = await reverseGeocode(coordinates.latitude, coordinates.longitude);
      if (locationSelectionRef.current === requestId) {
        setForm((current) => ({ ...current, address, city: '', area: '' }));
      }
    } catch {
      if (locationSelectionRef.current === requestId) setError(t('report.photoLocationAddressError'));
    }
  }

  function addPhoto(file, metadata) {
    if (photos.length >= 5) return;
    const nextPhoto = { file, metadata };
    setPhotos((current) => current.length < 5 ? [...current, nextPhoto] : current);
    setError('');
    setLocationMismatchConfirmed(false);
    if (!photos.some((photo) => photo.metadata.captureSource === 'live_camera')
      && metadata.captureSource === 'live_camera') {
      void selectFirstPhotoLocation(metadata);
    }
    setCameraCaptureKey((current) => current + 1);
    setGalleryCaptureKey((current) => current + 1);
  }

  function removePhoto(index) {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setError('');
    setLocationMismatchConfirmed(false);
  }

  const hasPhotoLocationMismatch = photos.some((photo) => (
    photo.metadata.captureSource === 'live_camera'
    && form.latitude !== ''
    && form.longitude !== ''
    && distanceMeters(
      Number(form.latitude),
      Number(form.longitude),
      photo.metadata.latitude,
      photo.metadata.longitude
    ) > 200
  ));

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (photos.length < 1) {
      setError(t('report.photoRequired'));
      return;
    }
    if (hasPhotoLocationMismatch && !locationMismatchConfirmed) {
      setError(t('report.locationMismatchConfirm'));
      return;
    }
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!form.latitude || !form.longitude || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || !form.address.trim()) {
      setError(t('report.locationError'));
      return;
    }
    setIsSubmitting(true);
    try {
      const duplicateResult = await checkComplaintDuplicates({ ...form, latitude, longitude });
      if (Array.isArray(duplicateResult?.candidates) && duplicateResult.candidates.length) {
        setDuplicateCandidate(duplicateResult.candidates[0]);
        return;
      }
      await submitComplaint(false, latitude, longitude);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('report.duplicateCheckError')));
    } finally { setIsSubmitting(false); }
  }

  async function submitComplaint(allowDuplicate, latitude = Number(form.latitude), longitude = Number(form.longitude)) {
    setIsSubmitting(true);
    setError('');
    try {
      const attachments = await uploadComplaintImages(photos, { latitude, longitude }, setUploadProgress);
      const complaint = await createComplaint({ ...form, latitude, longitude, attachments, allowDuplicate });
      setCreatedComplaint(complaint);
      setTipIndex(nextEducationalTip % reportTips.en.length);
      nextEducationalTip += 1;
      setShowEducationalTip(true);
      try {
        setClassification(await classifyComplaint(complaint._id));
      } catch {
        setError(t('report.manualReview'));
      }
    } catch (requestError) {
      const duplicate = requestError.response?.data?.error?.code === 'DUPLICATE_DETECTED'
        ? requestError.response.data.error.details?.candidate
        : null;
      if (duplicate) { setDuplicateCandidate(duplicate); return; }
      setError(getApiErrorMessage(requestError, t('report.submitError')));
    } finally { setIsSubmitting(false); setUploadProgress(null); }
  }

  async function supportExisting() {
    if (!duplicateCandidate) return;
    setIsSubmitting(true);
    setError('');
    try {
      await supportDuplicateComplaint(duplicateCandidate._id);
      setDuplicateSupported(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('report.supportError')));
    } finally { setIsSubmitting(false); }
  }

  function dismissDuplicatePrompt() {
    setDuplicateCandidate(null);
    setDuplicateSupported(false);
  }

  return <div className="form-page">
    <DuplicateWarningModal candidate={duplicateCandidate} busy={isSubmitting} supported={duplicateSupported} error={error} onSupport={supportExisting} onContinue={() => { dismissDuplicatePrompt(); void submitComplaint(true); }} onReview={dismissDuplicatePrompt} onBack={dismissDuplicatePrompt} onClose={dismissDuplicatePrompt} onViewComplaint={(complaintId) => { dismissDuplicatePrompt(); navigate(`/dashboard/complaints/${complaintId}`); }} />
    <Link className="back-link" to="/dashboard/complaints">← {t('report.back')}</Link>
    <PageHeader kicker={t('report.kicker')} title={t('report.title')} subtitle={t('report.subtitle')} />
    {showEducationalTip && <aside className="report-education-tip" role="status"><span aria-hidden="true">✦</span><p><strong>{t('report.communityTip')}</strong> {reportTips[i18n.resolvedLanguage === 'hi' ? 'hi' : 'en'][tipIndex]}</p></aside>}
    {classification && <section className="ai-prediction panel"><div><p className="eyebrow">{t('report.aiSuggestion')}</p><h2>{t('report.aiHeading')}</h2><p className="ai-prediction-note">{t('report.aiNote')}</p></div><div className="ai-prediction-values"><div><span>{t('report.category')}</span><strong>{t(`category.${classification.category}`, { defaultValue: classification.category.replaceAll('_', ' ') })}</strong></div><div><span>{t('report.priority')}</span><strong className={`prediction-${classification.priority}`}>{t(`priority.${classification.priority}`, { defaultValue: classification.priority })}</strong></div><div><span>{t('report.confidence')}</span><strong>{Math.round(classification.confidence * 100)}%</strong></div></div><Link className="text-button" to={`/dashboard/complaints/${createdComplaint?._id}`}>{t('report.openComplaint')} <span>→</span></Link></section>}
    <form className="complaint-form panel" onSubmit={handleSubmit}>
      <div className="form-section"><p className="form-section-title">{t('report.issue')}</p><label>{t('report.titleLabel')}<input name="title" value={form.title} onChange={updateField} placeholder={t('report.titlePlaceholder')} required minLength="5" maxLength="160" /></label><label>{t('report.description')}<textarea name="description" value={form.description} onChange={updateField} placeholder={t('report.descriptionPlaceholder')} required minLength="10" maxLength="5000" rows="5" /></label><div className="form-row"><label>{t('report.category')}<select name="category" value={form.category} onChange={updateField}>{complaintCategories.map((category) => <option key={category} value={category}>{t(`category.${category}`)}</option>)}</select></label><label>{t('report.priority')}<select name="priority" value={form.priority} onChange={updateField}>{complaintPriorities.map((priority) => <option key={priority} value={priority}>{t(`priority.${priority}`)}</option>)}</select></label></div><label className="anonymous-report-toggle"><input type="checkbox" name="isAnonymous" checked={form.isAnonymous} onChange={(event) => setForm((current) => ({ ...current, isAnonymous: event.target.checked }))} /><span><strong>{t('report.reportAnonymously')}</strong><small>{t('report.anonymousHelp')}</small></span></label></div>
      <div className="form-section"><div className="form-section-heading"><p className="form-section-title">{t('report.location')}</p><span>{form.latitude && form.longitude && form.address ? t('report.locationSelected') : t('report.required')}</span></div><LocationPicker latitude={form.latitude} longitude={form.longitude} address={form.address} onChange={updateLocation} disabled={isSubmitting || Boolean(createdComplaint)} /><NearbyComplaintsPanel latitude={form.latitude} longitude={form.longitude} /></div>
      <div className="form-section">
        <p className="form-section-title">{t('report.evidence')}</p>
        <p className="capture-photo-count">{t('report.photoCount', { count: photos.length })}</p>
        {photoPreviews.length > 0 && <div className="captured-report-photos">
          {photoPreviews.map((photo, index) => <figure className="captured-report-photo" key={`${photo.file.name}-${index}`}>
            <img src={photo.previewUrl} alt={t('report.photoPreviewAlt', { number: index + 1 })} width="400" height="300" />
            <figcaption>
              <span>{photo.metadata.captureSource === 'live_camera' ? t('report.liveCaptureBadge') : t('report.devGalleryBadge')}</span>
              {photo.metadata.capturedAt && <small>{t('report.photoTakenAt', { time: new Date(photo.metadata.capturedAt).toLocaleString(i18n.resolvedLanguage === 'hi' ? 'hi-IN' : 'en-IN') })}</small>}
              <button type="button" className="outline-button" disabled={isSubmitting || Boolean(createdComplaint)} onClick={() => removePhoto(index)}>{t('report.removePhoto')}</button>
            </figcaption>
          </figure>)}
        </div>}
        {photos.length < 5 && <LiveCameraCapture
          key={cameraCaptureKey}
          disabled={isSubmitting || Boolean(createdComplaint)}
          captureLabel={t('report.takePhoto')}
          submitLabel={t('report.usePhoto')}
          onSubmit={addPhoto}
        />}
        {photos.length < 5 && <DevGalleryProof
          key={galleryCaptureKey}
          disabled={isSubmitting || Boolean(createdComplaint)}
          chooseLabel={t('report.devGalleryChoose')}
          submitLabel={t('report.devGalleryAdd')}
          bannerLabel={t('report.devGalleryBanner')}
          onSubmit={addPhoto}
        />}
        {hasPhotoLocationMismatch && <div className="evidence-location-warning" role="alert">
          <p>{t('report.photoLocationMismatch')}</p>
          <label><input type="checkbox" checked={locationMismatchConfirmed} onChange={(event) => setLocationMismatchConfirmed(event.target.checked)} />{t('report.confirmPhotoLocation')}</label>
        </div>}
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {uploadProgress !== null && <div className="upload-progress" role="status"><progress max="100" value={uploadProgress} /><span>{t('report.uploadingPhotos', { percent: uploadProgress })}</span></div>}
      <div className="form-actions"><Link className="outline-button" to="/dashboard/complaints">{t('report.cancel')}</Link><button className="primary-button compact-button" type="submit" disabled={isSubmitting || createdComplaint}>{isSubmitting ? t('report.submitting') : createdComplaint ? t('report.submitted') : t('report.submit')} <span>→</span></button></div>
    </form>
    <aside className="report-guidance panel">
      <section>
        <p className="eyebrow">{t('report.actionable')}</p>
        <h2>{t('report.tipsTitle')}</h2>
        <ul className="report-tips-list">
          <li><span aria-hidden="true">✓</span><span><strong>{t('report.clearTitle')}</strong><small>{t('report.clearTitleHelp')}</small></span></li>
          <li><span aria-hidden="true">✓</span><span><strong>{t('report.exactLocation')}</strong><small>{t('report.exactLocationHelp')}</small></span></li>
          <li><span aria-hidden="true">✓</span><span><strong>{t('report.addPhoto')}</strong><small>{t('report.addPhotoHelp')}</small></span></li>
        </ul>
      </section>
      <section className="report-steps">
        <p className="eyebrow">{t('report.whatNext')}</p>
        <h2>{t('report.howItWorks')}</h2>
        <ol><li><span>1</span><strong>{t('report.stepReport')}</strong></li><li><span>2</span><strong>{t('report.stepAssigned')}</strong></li><li><span>3</span><strong>{t('report.stepResolved')}</strong></li></ol>
      </section>
      <p className="report-privacy-note"><strong>{t('report.privacyTitle')}</strong> {t('report.privacyNote')}</p>
    </aside>
  </div>;
}
