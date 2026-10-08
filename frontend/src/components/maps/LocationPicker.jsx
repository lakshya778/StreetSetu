import { useEffect, useRef, useState } from 'react';
import { reverseGeocode, searchAddresses } from '../../api/locations.js';
import MapPicker from './LazyMapPicker.jsx';

export default function LocationPicker({ latitude, longitude, address, onChange, disabled = false }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locationError, setLocationError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) { setSuggestions([]); return undefined; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try { setSuggestions(await searchAddresses(trimmed, { signal: controller.signal })); }
      catch (error) { if (error.name !== 'AbortError') setLocationError('Address search is unavailable right now. You can still choose a point on the map.'); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  async function selectCoordinates(coords, knownAddress = '') {
    const currentRequest = ++requestId.current;
    setLocationError('');
    setSuggestions([]);
    setQuery('');
    if (knownAddress) { onChange({ ...coords, address: knownAddress, city: coords.city || '', area: coords.area || '' }); return; }
    onChange({ ...coords, address: '' });
    try {
      const resolvedAddress = await reverseGeocode(coords.latitude, coords.longitude);
      if (requestId.current === currentRequest) onChange({ ...coords, address: resolvedAddress, city: '', area: '' });
    } catch {
      if (requestId.current === currentRequest) setLocationError('We could not find an address for this point. Please search for an address or choose another spot.');
    }
  }

  function useCurrentLocation() {
    setLocationError('');
    if (!navigator.geolocation) { setLocationError('Your browser does not support location sharing. Search for an address or choose a point on the map.'); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => selectCoordinates({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location access was blocked. Allow location access in your browser, or search for an address or choose a point on the map.'
          : 'We could not get your current location. Please search for an address or choose a point on the map.';
        setLocationError(message);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  return <div className="location-picker-controls">
    <div className="location-actions">
      <label className="address-search-label">Search for an address<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Street, landmark, or neighbourhood" autoComplete="off" disabled={disabled} /></label>
      <button type="button" className="outline-button location-button" onClick={useCurrentLocation} disabled={disabled}>Use My Current Location</button>
    </div>
    {query.trim().length >= 3 && <div className="address-suggestions" role="listbox" aria-label="Address suggestions">
      {searching && <div className="address-suggestion-status">Searching addresses…</div>}
      {!searching && suggestions.map((item) => <button type="button" role="option" className="address-suggestion" key={item.id} onClick={() => selectCoordinates(item, item.address)}>{item.address}</button>)}
      {!searching && suggestions.length === 0 && <div className="address-suggestion-status">No matching addresses found.</div>}
    </div>}
    <MapPicker latitude={latitude} longitude={longitude} onChange={(coords) => selectCoordinates(coords)} />
    <div className={`selected-address${address ? '' : ' selected-address-empty'}`} aria-live="polite"><span>Selected address</span><strong>{address || 'Choose a location to see its address'}</strong></div>
    {locationError && <p className="location-error" role="status">{locationError}</p>}
  </div>;
}
