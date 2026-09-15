import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';

const defaultCenter = [28.6139, 77.2090];
const pinIcon = L.divIcon({
  className: 'streetsetu-pin-wrapper',
  html: '<span class="streetsetu-pin"></span>',
  iconSize: [24, 32],
  iconAnchor: [12, 30]
});

function coordinatesFor(complaint) {
  const latitude = Number(complaint.latitude ?? complaint.location?.coordinates?.[1]);
  const longitude = Number(complaint.longitude ?? complaint.location?.coordinates?.[0]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null;
}

export default function ComplaintMap({ complaints = [], className = '' }) {
  const points = complaints.map((complaint) => ({ complaint, position: coordinatesFor(complaint) })).filter((item) => item.position);
  const center = points[0]?.position || defaultCenter;

  return (
    <div className={`complaint-map-shell ${className}`}>
      <MapContainer center={center} zoom={points.length ? 12 : 11} scrollWheelZoom className="complaint-map">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup chunkedLoading>
          {points.map(({ complaint, position }) => (
            <Marker key={complaint._id} position={position} icon={pinIcon}>
              <Popup>
                <strong>{complaint.title}</strong>
                <span className="map-popup-status">{complaint.status?.replaceAll('_', ' ')}</span>
                <Link to={`/dashboard/complaints/${complaint._id}`}>View complaint →</Link>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      <div className="map-legend"><span className="legend-dot" /> {points.length} mapped complaint{points.length === 1 ? '' : 's'} <span className="legend-separator" /> Clusters group nearby reports</div>
    </div>
  );
}
