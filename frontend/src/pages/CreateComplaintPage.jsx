import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { classifyComplaint, complaintCategories, createComplaint, complaintPriorities, uploadComplaintImages } from '../api/complaints.js';
import LocationPicker from '../components/maps/LocationPicker.jsx';

const initialForm = { title: '', description: '', category: 'roads', priority: 'medium', latitude: '', longitude: '', address: '' };

export default function CreateComplaintPage() {
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classification, setClassification] = useState(null);
  const [createdComplaint, setCreatedComplaint] = useState(null);

  function updateField(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }

  function updateLocation({ latitude, longitude }) {
    setForm((current) => ({
      ...current,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6)
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const attachments = files.length ? await uploadComplaintImages(files) : [];
      const complaint = await createComplaint({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), attachments });
      setCreatedComplaint(complaint);
      try {
        setClassification(await classifyComplaint(complaint._id));
      } catch (classificationError) {
        setError(`Complaint submitted, but AI classification is unavailable. ${getApiErrorMessage(classificationError, '')}`.trim());
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'The complaint could not be submitted.'));
    } finally { setIsSubmitting(false); }
  }

  return <div className="form-page"><div className="page-heading"><div><Link className="back-link" to="/dashboard/complaints">← Back to complaints</Link><p className="eyebrow">New civic report</p><h1>Tell us what needs attention.</h1><p className="page-lede">A clear report helps the right people act faster.</p></div></div>{classification && <section className="ai-prediction panel"><div><p className="eyebrow">AI triage suggestion</p><h2>Here is what the model sees.</h2><p className="ai-prediction-note">This recommendation is saved for human review and does not change your report automatically.</p></div><div className="ai-prediction-values"><div><span>Category</span><strong>{classification.category.replaceAll('_', ' ')}</strong></div><div><span>Priority</span><strong className={`prediction-${classification.priority}`}>{classification.priority}</strong></div><div><span>Confidence</span><strong>{Math.round(classification.confidence * 100)}%</strong></div></div><Link className="text-button" to={`/dashboard/complaints/${createdComplaint?._id}`}>Open complaint <span>→</span></Link></section>}<form className="complaint-form panel" onSubmit={handleSubmit}><div className="form-section"><p className="form-section-title">The issue</p><label>Title<input name="title" value={form.title} onChange={updateField} placeholder="e.g. Street light out near the market" required minLength="5" maxLength="160" /></label><label>Description<textarea name="description" value={form.description} onChange={updateField} placeholder="Describe what is happening, where, and how it affects the neighbourhood." required minLength="10" maxLength="5000" rows="5" /></label><div className="form-row"><label>Category<select name="category" value={form.category} onChange={updateField}>{complaintCategories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></label><label>Priority<select name="priority" value={form.priority} onChange={updateField}>{complaintPriorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label></div></div><div className="form-section"><div className="form-section-heading"><p className="form-section-title">Location</p><span>{form.latitude && form.longitude ? 'Location selected' : 'Required'}</span></div><LocationPicker latitude={form.latitude} longitude={form.longitude} onChange={updateLocation} /><div className="form-row"><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" value={form.latitude} onChange={updateField} placeholder="28.6139" required /></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" value={form.longitude} onChange={updateField} placeholder="77.2090" required /></label></div><label>Address or landmark <input name="address" value={form.address} onChange={updateField} placeholder="Near the community gate" /></label></div><div className="form-section"><p className="form-section-title">Evidence</p><label>Images <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 10))} /></label>{files.length > 0 && <p className="file-summary">{files.length} image{files.length > 1 ? 's' : ''} ready to upload</p>}</div>{error && <div className="form-error" role="alert">{error}</div>}<div className="form-actions"><Link className="outline-button" to="/dashboard/complaints">Cancel</Link><button className="primary-button compact-button" type="submit" disabled={isSubmitting || createdComplaint}>{isSubmitting ? 'Submitting...' : createdComplaint ? 'Complaint submitted' : 'Submit complaint'} <span>→</span></button></div></form></div>;
}
