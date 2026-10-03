import { useState } from 'react';
import api from '../../api/client.js';
import { complaintCategories } from '../../api/complaints.js';
import MapPicker from '../maps/MapPicker.jsx';

const availabilityOptions = [
  { value: 'available', label: 'Available' },
  { value: 'limited', label: 'Limited availability' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'weekend', label: 'Weekends' },
  { value: 'flexible', label: 'Flexible' }
];

export default function VolunteerProfileForm({ user, onSaved }) {
  const [expertiseCategories, setExpertiseCategories] = useState(user?.expertiseCategories || []);
  const [coordinates, setCoordinates] = useState(() => ({
    latitude: user?.location?.coordinates?.[1] ?? '',
    longitude: user?.location?.coordinates?.[0] ?? ''
  }));
  const [profile, setProfile] = useState({ phone: user?.phone || '', area: user?.area || '', city: user?.city || '', availability: user?.availability || 'available' });
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function toggleCategory(category) {
    setExpertiseCategories((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
  }

  function updateProfile(event) { setProfile((current) => ({ ...current, [event.target.name]: event.target.value })); }

  async function saveProfile(event) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      const payload = { ...profile, expertiseCategories };
      if (coordinates.latitude !== '' && coordinates.longitude !== '') {
        payload.latitude = Number(coordinates.latitude);
        payload.longitude = Number(coordinates.longitude);
      }
      const { data } = await api.patch('/users/me/volunteer-profile', payload);
      setExpertiseCategories(data.data.expertiseCategories || []);
      setProfile((current) => ({ ...current, phone: data.data.phone || '', area: data.data.area || '', city: data.data.city || '', availability: data.data.availability || 'available' }));
      onSaved?.(data.data);
      setMessage('Your contact details, work area, availability, and expertise are saved for assignment recommendations.');
    } catch {
      setMessage('Your volunteer profile could not be saved. Please check the fields and try again.');
    } finally { setIsSaving(false); }
  }

  return <details className="panel volunteer-profile-panel">
    <summary><span><small className="eyebrow">Assignment preferences</small><strong>Set your work area and availability</strong></span><span className="profile-disclosure">Edit</span></summary>
    <form onSubmit={saveProfile}>
      <div className="volunteer-profile-fields">
        <label>Phone number<input name="phone" type="tel" autoComplete="tel" maxLength="30" value={profile.phone} onChange={updateProfile} placeholder="Contact number for assignments" /></label>
        <label>City<input name="city" maxLength="120" value={profile.city} onChange={updateProfile} placeholder="Your city" /></label>
        <label>Area or neighbourhood<input name="area" maxLength="160" value={profile.area} onChange={updateProfile} placeholder="Your usual work area" /></label>
        <label>Availability<select name="availability" value={profile.availability} onChange={updateProfile}>{availabilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      <fieldset><legend>Categories you know well</legend><div className="expertise-options">{complaintCategories.map((category) => <label key={category}><input type="checkbox" checked={expertiseCategories.includes(category)} onChange={() => toggleCategory(category)} /><span>{category.replaceAll('_', ' ')}</span></label>)}</div></fieldset>
      <div className="volunteer-profile-location"><div><p className="form-section-title">Your usual work point</p><p className="page-lede">Set a point so recommendations can estimate travel distance.</p><div className="form-row"><label>Latitude<input type="number" min="-90" max="90" step="any" value={coordinates.latitude} onChange={(event) => setCoordinates((current) => ({ ...current, latitude: event.target.value }))} /></label><label>Longitude<input type="number" min="-180" max="180" step="any" value={coordinates.longitude} onChange={(event) => setCoordinates((current) => ({ ...current, longitude: event.target.value }))} /></label></div></div><MapPicker latitude={coordinates.latitude} longitude={coordinates.longitude} onChange={(next) => setCoordinates({ latitude: next.latitude.toFixed(6), longitude: next.longitude.toFixed(6) })} /></div>
      {message && <p className="profile-save-message" role="status">{message}</p>}
      <button className="primary-button compact-button" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save preferences'}</button>
    </form>
  </details>;
}
