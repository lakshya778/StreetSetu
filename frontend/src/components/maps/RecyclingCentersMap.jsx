import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return <div className="recycling-map-shell">
    <MapContainer center={[28.6139, 77.209]} zoom={10} scrollWheelZoom={false} className="recycling-map">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {centers.map((center) => <Marker key={center.id} position={[center.lat, center.lng]} icon={centerIcon}>
        <Popup><strong>{t(`guide.center.${center.id}`)}</strong><br />{t('guide.accepts', { items: center.accepts.map((item) => t(`guide.acceptance.${item}`)).join(', ') })}</Popup>
      </Marker>)}
    </MapContainer>
  </div>;
}
