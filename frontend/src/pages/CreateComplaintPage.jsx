import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { checkComplaintDuplicates, classifyComplaint, complaintCategories, createComplaint, complaintPriorities, supportDuplicateComplaint, uploadComplaintImages } from '../api/complaints.js';
import ImageUploader from '../components/media/ImageUploader.jsx';
import DuplicateWarningModal from '../components/complaints/DuplicateWarningModal.jsx';
import LocationPicker from '../components/maps/LocationPicker.jsx';
import NearbyComplaintsPanel from '../components/complaints/NearbyComplaintsPanel.jsx';

const initialForm = { title: '', description: '', category: 'roads', priority: 'medium', latitude: '', longitude: '', address: '', city: '', area: '' };

export default function CreateComplaintPage() {
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      if (duplicateResult.candidates.length) {
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
      const attachments = files.length ? await uploadComplaintImages(files) : [];
      const complaint = await createComplaint({ ...form, latitude, longitude, attachments, allowDuplicate });
      setCreatedComplaint(complaint);
      try {
        setClassification(await classifyComplaint(complaint._id));
      } catch (classificationError) {
        setError(`Complaint submitted, but AI classification is unavailable. ${getApiErrorMessage(classificationError, '')}`.trim());
      }
    } catch (requestError) {
      const duplicate = requestError.response?.data?.error?.code === 'DUPLICATE_DETECTED'
        ? requestError.response.data.error.details?.candidate
        : null;
      if (duplicate) { setDuplicateCandidate(duplicate); return; }
      setError(getApiErrorMessage(requestError, 'The complaint could not be submitted.'));
    } finally { setIsSubmitting(false); }
  }

  async function supportExisting() {
    if (!duplicateCandidate) return;
    setIsSubmitting(true);
    try {
      await supportDuplicateComplaint(duplicateCandidate._id);
      setDuplicateSupported(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Your support could not be added.'));
      setDuplicateCandidate(null);
    } finally { setIsSubmitting(false); }
  }

  return <div className="form-page">
    <DuplicateWarningModal candidate={duplicateCandidate} busy={isSubmitting} supported={duplicateSupported} onSupport={supportExisting} onContinue={() => { setDuplicateCandidate(null); setDuplicateSupported(false); void submitComplaint(true); }} onCancel={() => { setDuplicateCandidate(null); setDuplicateSupported(false); }} />
    <div className="page-heading"><div><Link className="back-link" to="/dashboard/complaints">← Back to complaints</Link><p className="eyebrow">New civic report</p><h1>Tell us what needs attention.</h1><p className="page-lede">A clear report helps the right people act faster.</p></div></div>
    {classification && <section className="ai-prediction panel"><div><p className="eyebrow">AI triage suggestion</p><h2>Here is what the model sees.</h2><p className="ai-prediction-note">This recommendation is saved for human review and does not change your report automatically.</p></div><div className="ai-prediction-values"><div><span>Category</span><strong>{classification.category.replaceAll('_', ' ')}</strong></div><div><span>Priority</span><strong className={`prediction-${classification.priority}`}>{classification.priority}</strong></div><div><span>Confidence</span><strong>{Math.round(classification.confidence * 100)}%</strong></div></div><Link className="text-button" to={`/dashboard/complaints/${createdComplaint?._id}`}>Open complaint <span>→</span></Link></section>}
    <form className="complaint-form panel" onSubmit={handleSubmit}>
      <div className="form-section"><p className="form-section-title">The issue</p><label>Title<input name="title" value={form.title} onChange={updateField} placeholder="e.g. Street light out near the market" required minLength="5" maxLength="160" /></label><label>Description<textarea name="description" value={form.description} onChange={updateField} placeholder="Describe what is happening, where, and how it affects the neighbourhood." required minLength="10" maxLength="5000" rows="5" /></label><div className="form-row"><label>Category<select name="category" value={form.category} onChange={updateField}>{complaintCategories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></label><label>Priority<select name="priority" value={form.priority} onChange={updateField}>{complaintPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label></div></div>
      <div className="form-section"><div className="form-section-heading"><p className="form-section-title">Location</p><span>{form.latitude && form.longitude && form.address ? 'Location selected' : 'Required'}</span></div><LocationPicker latitude={form.latitude} longitude={form.longitude} address={form.address} onChange={updateLocation} disabled={isSubmitting || Boolean(createdComplaint)} /><NearbyComplaintsPanel latitude={form.latitude} longitude={form.longitude} /></div>
      <div className="form-section"><p className="form-section-title">Evidence</p><ImageUploader files={files} onChange={setFiles} disabled={isSubmitting || Boolean(createdComplaint)} label="Add complaint photos" /></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-actions"><Link className="outline-button" to="/dashboard/complaints">Cancel</Link><button className="primary-button compact-button" type="submit" disabled={isSubmitting || createdComplaint}>{isSubmitting ? 'Submitting...' : createdComplaint ? 'Complaint submitted' : 'Submit complaint'} <span>→</span></button></div>
    </form>
  </div>;
}
