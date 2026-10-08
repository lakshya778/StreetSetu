import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { checkComplaintDuplicates, classifyComplaint, complaintCategories, createComplaint, complaintPriorities, supportDuplicateComplaint, uploadComplaintImages } from '../api/complaints.js';
import ImageUploader from '../components/media/ImageUploader.jsx';
import DuplicateWarningModal from '../components/complaints/DuplicateWarningModal.jsx';
import LocationPicker from '../components/maps/LocationPicker.jsx';
import PageHeader from '../components/layout/PageHeader.jsx';
import NearbyComplaintsPanel from '../components/complaints/NearbyComplaintsPanel.jsx';

const initialForm = { title: '', description: '', category: 'roads', priority: 'medium', latitude: '', longitude: '', address: '', city: '', area: '' };

export default function CreateComplaintPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [classification, setClassification] = useState(null);
  const [createdComplaint, setCreatedComplaint] = useState(null);
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
      setError('Please choose a valid location and wait for its address to appear before submitting.');
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
      setError(getApiErrorMessage(requestError, 'The complaint could not be checked for duplicates. Please try again.'));
    } finally { setIsSubmitting(false); }
  }

  async function submitComplaint(allowDuplicate, latitude = Number(form.latitude), longitude = Number(form.longitude)) {
    setIsSubmitting(true);
    setError('');
    try {
      const attachments = files.length ? await uploadComplaintImages(files, setUploadProgress) : [];
      const complaint = await createComplaint({ ...form, latitude, longitude, attachments, allowDuplicate });
      setCreatedComplaint(complaint);
      try {
        setClassification(await classifyComplaint(complaint._id));
      } catch {
        setError('Manual review required. Your complaint was submitted successfully and duplicate detection completed.');
      }
    } catch (requestError) {
      const duplicate = requestError.response?.data?.error?.code === 'DUPLICATE_DETECTED'
        ? requestError.response.data.error.details?.candidate
        : null;
      if (duplicate) { setDuplicateCandidate(duplicate); return; }
      setError(getApiErrorMessage(requestError, 'The complaint could not be submitted.'));
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
      setError(getApiErrorMessage(requestError, 'Your support could not be added.'));
    } finally { setIsSubmitting(false); }
  }

  function dismissDuplicatePrompt() {
    setDuplicateCandidate(null);
    setDuplicateSupported(false);
  }

  return <div className="form-page">
    <DuplicateWarningModal candidate={duplicateCandidate} busy={isSubmitting} supported={duplicateSupported} error={error} onSupport={supportExisting} onContinue={() => { dismissDuplicatePrompt(); void submitComplaint(true); }} onReview={dismissDuplicatePrompt} onBack={dismissDuplicatePrompt} onClose={dismissDuplicatePrompt} onViewComplaint={(complaintId) => { dismissDuplicatePrompt(); navigate(`/dashboard/complaints/${complaintId}`); }} />
    <Link className="back-link" to="/dashboard/complaints">← Back to complaints</Link>
    <PageHeader kicker="New civic report" title="Tell us what needs attention." subtitle="A clear report helps the right people act faster." />
    {classification && <section className="ai-prediction panel"><div><p className="eyebrow">AI triage suggestion</p><h2>Here is what the model sees.</h2><p className="ai-prediction-note">This recommendation is saved for human review and does not change your report automatically.</p></div><div className="ai-prediction-values"><div><span>Category</span><strong>{classification.category.replaceAll('_', ' ')}</strong></div><div><span>Priority</span><strong className={`prediction-${classification.priority}`}>{classification.priority}</strong></div><div><span>Confidence</span><strong>{Math.round(classification.confidence * 100)}%</strong></div></div><Link className="text-button" to={`/dashboard/complaints/${createdComplaint?._id}`}>Open complaint <span>→</span></Link></section>}
    <form className="complaint-form panel" onSubmit={handleSubmit}>
      <div className="form-section"><p className="form-section-title">The issue</p><label>Title<input name="title" value={form.title} onChange={updateField} placeholder="e.g. Street light out near the market" required minLength="5" maxLength="160" /></label><label>Description<textarea name="description" value={form.description} onChange={updateField} placeholder="Describe what is happening, where, and how it affects the neighbourhood." required minLength="10" maxLength="5000" rows="5" /></label><div className="form-row"><label>Category<select name="category" value={form.category} onChange={updateField}>{complaintCategories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></label><label>Priority<select name="priority" value={form.priority} onChange={updateField}>{complaintPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label></div></div>
      <div className="form-section"><div className="form-section-heading"><p className="form-section-title">Location</p><span>{form.latitude && form.longitude && form.address ? 'Location selected' : 'Required'}</span></div><LocationPicker latitude={form.latitude} longitude={form.longitude} address={form.address} onChange={updateLocation} disabled={isSubmitting || Boolean(createdComplaint)} /><NearbyComplaintsPanel latitude={form.latitude} longitude={form.longitude} /></div>
      <div className="form-section"><p className="form-section-title">Evidence</p><ImageUploader files={files} onChange={setFiles} disabled={isSubmitting || Boolean(createdComplaint)} label="Add complaint photos" /></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {uploadProgress !== null && <div className="upload-progress" role="status"><progress max="100" value={uploadProgress} /><span>Uploading photos · {uploadProgress}%</span></div>}
      <div className="form-actions"><Link className="outline-button" to="/dashboard/complaints">Cancel</Link><button className="primary-button compact-button" type="submit" disabled={isSubmitting || createdComplaint}>{isSubmitting ? 'Submitting...' : createdComplaint ? 'Complaint submitted' : 'Submit complaint'} <span>→</span></button></div>
    </form>
    <aside className="report-guidance panel">
      <section>
        <p className="eyebrow">Make it actionable</p>
        <h2>Tips for a good report</h2>
        <ul className="report-tips-list">
          <li><span aria-hidden="true">✓</span><span><strong>Clear title</strong><small>Describe the issue in a few words.</small></span></li>
          <li><span aria-hidden="true">✓</span><span><strong>Exact location</strong><small>Pinpoint where the issue needs attention.</small></span></li>
          <li><span aria-hidden="true">✓</span><span><strong>Add a photo</strong><small>Show the issue clearly when possible.</small></span></li>
        </ul>
      </section>
      <section className="report-steps">
        <p className="eyebrow">What happens next</p>
        <h2>How it works</h2>
        <ol><li><span>1</span><strong>Report</strong></li><li><span>2</span><strong>Assigned</strong></li><li><span>3</span><strong>Resolved with proof</strong></li></ol>
      </section>
      <p className="report-privacy-note"><strong>Your privacy matters.</strong> Location and photos are used to help verify and resolve your report.</p>
    </aside>
  </div>;
}
