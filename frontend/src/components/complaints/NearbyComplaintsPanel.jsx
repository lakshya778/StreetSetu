import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/client.js';
import { getNearbyComplaints } from '../../api/complaints.js';

const radiusOptions = [
  { value: 500, label: '500 m' },
  { value: 1000, label: '1 km' },
  { value: 5000, label: '5 km' }
];

function distanceLabel(distanceMeters) {
  return distanceMeters < 1000 ? `${Math.round(distanceMeters)} m` : `${(distanceMeters / 1000).toFixed(1)} km`;
}

export default function NearbyComplaintsPanel({ latitude, longitude }) {
  const [radius, setRadius] = useState(1000);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (latitude === '' || longitude === '' || latitude == null || longitude == null
      || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      setItems([]);
      return undefined;
    }
    let active = true;
    setIsLoading(true);
    setError('');
    getNearbyComplaints({ latitude: Number(latitude), longitude: Number(longitude), radius })
      .then((result) => { if (active) setItems(result.items || []); })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Nearby reports could not be loaded.')); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [latitude, longitude, radius]);

  if (latitude === '' || longitude === '' || latitude == null || longitude == null) return null;
  return <section className="nearby-complaints-panel" aria-label="Nearby complaints">
    <div className="nearby-panel-heading"><div><p className="eyebrow">Already reported nearby?</p><h3>Nearby complaints</h3></div><label>Search radius<select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>{radiusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label></div>
    {error && <p className="nearby-panel-message" role="status">{error}</p>}
    {isLoading ? <p className="nearby-panel-message">Checking reports within {radiusOptions.find((item) => item.value === radius)?.label}…</p>
      : items.length ? <div className="nearby-complaint-list">{items.map((item) => <article className="nearby-complaint-row" key={item._id}><div><Link to={`/dashboard/complaints/${item._id}`} target="_blank" rel="noreferrer">{item.title}</Link><small>{item.category?.replaceAll('_', ' ')} · {item.status?.replaceAll('_', ' ')}</small></div><div className="nearby-complaint-stats"><strong>{distanceLabel(item.distanceMeters)}</strong><small>{item.supportCount} support{item.supportCount === 1 ? '' : 's'}</small></div></article>)}</div>
        : <p className="nearby-panel-message">No existing reports found within this radius.</p>}
  </section>;
}
