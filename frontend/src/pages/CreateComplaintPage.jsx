import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { checkComplaintDuplicates, classifyComplaint, complaintCategories, createComplaint, complaintPriorities, supportDuplicateComplaint, uploadComplaintImages } from '../api/complaints.js';
import ImageUploader from '../components/media/ImageUploader.jsx';
import DuplicateWarningModal from '../components/complaints/DuplicateWarningModal.jsx';
import LocationPicker from '../components/maps/LocationPicker.jsx';
import PageHeader from '../components/layout/PageHeader.jsx';
import NearbyComplaintsPanel from '../components/complaints/NearbyComplaintsPanel.jsx';
import reportTips from '../data/reportTips.json';

const initialForm = { title: '', description: '', category: 'roads', priority: 'medium', isAnonymous: false, latitude: '', longitude: '', address: '', city: '', area: '' };
let nextEducationalTip = 0;

export default function CreateComplaintPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [classification, setClassification] = useState(null);
  const [createdComplaint, setCreatedComplaint] = useState(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [showEducationalTip, setShowEducationalTip] = useState(false);
  const [duplicateCandidate, setDuplicateCandidate] = useState(null);
  const [duplicateSupported, setDuplicateSupported] = useState(false);

  function updateField(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }

  function updateLocation({ latitude, longitude, address, city = '', area = '' }) {
    setForm((current) => ({ ...current, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6), address, city, area }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
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
      const attachments = files.length ? await uploadComplaintImages(files, setUploadProgress) : [];
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
      <div className="form-section"><p className="form-section-title">{t('report.evidence')}</p><ImageUploader files={files} onChange={setFiles} disabled={isSubmitting || Boolean(createdComplaint)} label={t('report.addPhotos')} /></div>
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
