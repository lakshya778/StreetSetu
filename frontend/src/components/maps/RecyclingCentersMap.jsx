import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import centers from '../../data/recyclingCenters.json';
import 'leaflet/dist/leaflet.css';

const centerIcon = L.divIcon({
  className: 'recycling-center-marker',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

export default function RecyclingCentersMap() {
  return <div className="recycling-map-shell">
    <MapContainer center={[28.6139, 77.209]} zoom={10} scrollWheelZoom={false} className="recycling-map">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {centers.map((center) => <Marker key={center.id} position={[center.lat, center.lng]} icon={centerIcon}>
        <Popup><strong>{center.name}</strong><br />Accepts: {center.accepts.join(', ')}</Popup>
      </Marker>)}
    </MapContainer>
  </div>;
}
