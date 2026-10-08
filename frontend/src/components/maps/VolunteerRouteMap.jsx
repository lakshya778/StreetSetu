import { Link } from 'react-router-dom';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const fallbackCenter = [28.6139, 77.2090];
const assignmentIcon = L.divIcon({ className: 'streetsetu-pin-wrapper', html: '<span class="streetsetu-pin"></span>', iconSize: [24, 32], iconAnchor: [12, 30] });
const volunteerIcon = L.divIcon({ className: 'streetsetu-pin-wrapper', html: '<span class="streetsetu-pin volunteer-current-pin"></span>', iconSize: [26, 34], iconAnchor: [13, 31] });

export default function VolunteerRouteMap({ route }) {
  const volunteerPosition = route?.volunteerPosition ? [route.volunteerPosition.latitude, route.volunteerPosition.longitude] : null;
  const routePoints = (route?.assignments || []).map((item) => {
    const coordinates = item.complaint?.location?.coordinates;
    return Array.isArray(coordinates) && coordinates.length === 2 ? [coordinates[1], coordinates[0]] : null;
  }).filter(Boolean);
  const linePoints = [...(volunteerPosition ? [volunteerPosition] : []), ...routePoints];
  const center = volunteerPosition || routePoints[0] || fallbackCenter;
  return <section className="panel volunteer-route-map-panel"><div className="panel-heading"><div><p className="eyebrow">Field coordination</p><h2>Today’s route</h2></div></div>
    <div className="complaint-map-shell"><MapContainer key={`${center[0]}-${center[1]}-${routePoints.length}`} center={center} zoom={routePoints.length ? 13 : 11} scrollWheelZoom className="complaint-map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {volunteerPosition && <Marker position={volunteerPosition} icon={volunteerIcon}><Popup>Your saved volunteer location</Popup></Marker>}
      {route?.assignments?.map((item, index) => {
        const coordinates = item.complaint?.location?.coordinates;
        if (!coordinates || coordinates.length !== 2) return null;
        const position = [coordinates[1], coordinates[0]];
        return <Marker key={item._id} position={position} icon={assignmentIcon}><Popup><div className="map-popup-content"><strong>{item.routeOrder}. {item.complaint.title}</strong><span className="map-popup-status">{item.complaint.status?.replaceAll('_', ' ')}</span><Link to={`/dashboard/complaints/${item.complaint._id}`}>Open assignment</Link></div></Popup></Marker>;
      })}
      {linePoints.length > 1 && <Polyline positions={linePoints} pathOptions={{ color: '#5e896b', weight: 4, opacity: 0.8, dashArray: '7 8' }} />}
    </MapContainer></div>
    {!volunteerPosition && <p className="nearby-panel-message">Add your current location in your volunteer profile to include it as the route starting point.</p>}
  </section>;
}
