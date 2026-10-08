import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../api/client.js';
import { createDrive, getDrives, joinDrive, leaveDrive } from '../api/drives.js';
import PageHeader from '../components/layout/PageHeader.jsx';

const initialForm = { title: '', description: '', locationText: '', date: '', lat: '', lng: '' };

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function VolunteerDrivesPage() {
  const [drives, setDrives] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyDriveId, setBusyDriveId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadDrives() {
    setError('');
    try { setDrives(await getDrives()); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Volunteer drives could not be loaded.')); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadDrives(); }, []);

  async function submitDrive(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const drive = await createDrive({
        ...form,
        date: new Date(form.date).toISOString(),
        lat: form.lat === '' ? undefined : Number(form.lat),
        lng: form.lng === '' ? undefined : Number(form.lng)
      });
      setDrives((current) => [...current, drive].sort((a, b) => new Date(a.date) - new Date(b.date)));
      setForm(initialForm);
      setNotice('Your volunteer drive has been created.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'The drive could not be created.'));
    } finally { setSubmitting(false); }
  }

  async function toggleParticipation(drive) {
    setBusyDriveId(drive._id);
    setError('');
    setNotice('');
    try {
      const updated = drive.isParticipating ? await leaveDrive(drive._id) : await joinDrive(drive._id);
      setDrives((current) => current.map((item) => item._id === updated._id ? updated : item));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Your participation could not be updated.'));
    } finally { setBusyDriveId(''); }
  }

  return <div className="drives-page">
    <PageHeader kicker="Neighbourhood action" title="Volunteer drives" subtitle="Find a local activity or bring neighbours together around one." />
    {error && <div className="form-error" role="alert">{error}</div>}
    {notice && <div className="notice-banner" role="status">{notice}</div>}
    <section className="drives-layout">
      <div className="drives-list-section">
        <div className="panel-heading"><div><p className="eyebrow">Coming up</p><h2>Upcoming drives</h2></div></div>
        {loading ? <div className="page-skeleton" role="status" aria-label="Loading volunteer drives"><span /><span /><span /></div>
          : drives.length ? <div className="drives-list">{drives.map((drive) => <article className="panel drive-card" key={drive._id}>
            <div className="drive-card-top"><div><p className="eyebrow">{formatDate(drive.date)}</p><h3>{drive.title}</h3></div><span className="drive-participants">{drive.participantCount} {drive.participantCount === 1 ? 'participant' : 'participants'}</span></div>
            <p>{drive.description}</p>
            <div className="drive-card-footer"><span className="drive-location">{drive.locationText}</span><button className={drive.isParticipating ? 'outline-button' : 'primary-button'} type="button" disabled={busyDriveId === drive._id} onClick={() => void toggleParticipation(drive)}>{busyDriveId === drive._id ? 'Saving…' : drive.isParticipating ? 'Leave drive' : 'Join drive'}</button></div>
          </article>)}</div>
            : <div className="panel drive-empty"><h3>No upcoming drives yet</h3><p>Create the first activity for your neighbourhood.</p></div>}
      </div>
      <form className="panel drive-create-form" onSubmit={submitDrive}>
        <p className="eyebrow">Organize together</p><h2>Create a drive</h2>
        <label>Title<input required minLength="3" maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Sunday park clean-up" /></label>
        <label>Description<textarea required minLength="5" maxLength="2000" rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What will volunteers do?" /></label>
        <label>Location<input required maxLength="240" value={form.locationText} onChange={(event) => setForm({ ...form, locationText: event.target.value })} placeholder="Park, street or meeting point" /></label>
        <label>Date and time<input required type="datetime-local" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <div className="form-row"><label>Latitude (optional)<input type="number" min="-90" max="90" step="any" value={form.lat} onChange={(event) => setForm({ ...form, lat: event.target.value })} /></label><label>Longitude (optional)<input type="number" min="-180" max="180" step="any" value={form.lng} onChange={(event) => setForm({ ...form, lng: event.target.value })} /></label></div>
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create drive'}</button>
      </form>
    </section>
  </div>;
}
