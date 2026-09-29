import { useState } from 'react';
import api from '../../api/client.js';
import { complaintCategories } from '../../api/complaints.js';
import MapPicker from '../maps/MapPicker.jsx';

export default function VolunteerProfileForm({ user }) {
  const [expertiseCategories, setExpertiseCategories] = useState(user?.expertiseCategories || []);
  const [coordinates, setCoordinates] = useState(() => ({
    latitude: user?.location?.coordinates?.[1] ?? '',
    longitude: user?.location?.coordinates?.[0] ?? ''
  }));
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function toggleCategory(category) {
    setExpertiseCategories((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
  }

  async function saveProfile(event) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      const payload = { expertiseCategories };
      if (coordinates.latitude !== '' && coordinates.longitude !== '') {
        payload.latitude = Number(coordinates.latitude);
        payload.longitude = Number(coordinates.longitude);
      }
      const { data } = await api.patch('/users/me/volunteer-profile', payload);
      setExpertiseCategories(data.data.expertiseCategories || []);
      setMessage('Your expertise and work location are saved for volunteer recommendations.');
    } catch {
      setMessage('Your volunteer profile could not be saved. Please try again.');
    } finally { setIsSaving(false); }
  }

  return <details className="panel volunteer-profile-panel">
    <summary><span><small className="eyebrow">Assignment preferences</small><strong>Set your expertise and work location</strong></span><span className="profile-disclosure">Edit</span></summary>
    <form onSubmit={saveProfile}>
      <fieldset><legend>Categories you know well</legend><div className="expertise-options">{complaintCategories.map((category) => <label key={category}><input type="checkbox" checked={expertiseCategories.includes(category)} onChange={() => toggleCategory(category)} /><span>{category.replaceAll('_', ' ')}</span></label>)}</div></fieldset>
      <div className="volunteer-profile-location"><div><p className="form-section-title">Your usual work area</p><p className="page-lede">Choosing a map point helps administrators factor travel distance into recommendations.</p><div className="form-row"><label>Latitude<input type="number" min="-90" max="90" step="any" value={coordinates.latitude} onChange={(event) => setCoordinates((current) => ({ ...current, latitude: event.target.value }))} /></label><label>Longitude<input type="number" min="-180" max="180" step="any" value={coordinates.longitude} onChange={(event) => setCoordinates((current) => ({ ...current, longitude: event.target.value }))} /></label></div></div><MapPicker latitude={coordinates.latitude} longitude={coordinates.longitude} onChange={(next) => setCoordinates({ latitude: next.latitude.toFixed(6), longitude: next.longitude.toFixed(6) })} /></div>
      {message && <p className="profile-save-message" role="status">{message}</p>}
      <button className="primary-button compact-button" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save preferences'}</button>
    </form>
  </details>;
}
