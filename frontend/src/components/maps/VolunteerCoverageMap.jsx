import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';

const fallbackCenter = [28.6139, 77.2090];
const volunteerIcon = L.divIcon({ className: 'streetsetu-pin-wrapper', html: '<span class="streetsetu-pin volunteer-current-pin"></span>', iconSize: [26, 34], iconAnchor: [13, 31] });

export default function VolunteerCoverageMap({ volunteers = [] }) {
  const center = volunteers.length ? [volunteers[0].latitude, volunteers[0].longitude] : fallbackCenter;
  return <section className="panel volunteer-coverage-panel"><div className="panel-heading"><div><p className="eyebrow">Volunteer coverage</p><h2>Active volunteer locations</h2></div><span className="heatmap-count">{volunteers.length} mapped</span></div>
    <div className="complaint-map-shell"><MapContainer key={`${center[0]}-${center[1]}-${volunteers.length}`} center={center} zoom={volunteers.length ? 11 : 10} scrollWheelZoom className="complaint-map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {volunteers.map((volunteer) => <Marker key={volunteer._id} position={[volunteer.latitude, volunteer.longitude]} icon={volunteerIcon}><Popup><strong>{volunteer.name}</strong><br />{[volunteer.area, volunteer.city].filter(Boolean).join(', ') || 'Area not provided'}</Popup></Marker>)}
    </MapContainer></div>
    {!volunteers.length && <p className="nearby-panel-message">Volunteer locations will appear here when volunteers add them to their profile.</p>}
  </section>;
}
