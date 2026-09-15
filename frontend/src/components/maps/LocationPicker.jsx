import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const defaultCenter = [28.6139, 77.2090];
const pinIcon = L.divIcon({
  className: 'streetsetu-pin-wrapper',
  html: '<span class="streetsetu-pin streetsetu-pin-selected"></span>',
  iconSize: [24, 32],
  iconAnchor: [12, 30]
});

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    }
  });
  return null;
}

export default function LocationPicker({ latitude, longitude, onChange }) {
  const hasLocation = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const position = hasLocation ? [Number(latitude), Number(longitude)] : null;

  return (
    <div className="location-picker">
      <MapContainer center={position || defaultCenter} zoom={position ? 15 : 11} scrollWheelZoom className="complaint-map picker-map">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onSelect={onChange} />
        {position && <Marker position={position} icon={pinIcon} />}
      </MapContainer>
      <div className="map-hint"><span>⌖</span> Click the map to place the complaint location</div>
    </div>
  );
}
