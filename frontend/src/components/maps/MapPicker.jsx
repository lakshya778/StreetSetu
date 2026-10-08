import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultCenter = [28.6139, 77.2090];
const pinIcon = L.divIcon({
  className: 'streetsetu-pin-wrapper',
  html: '<span class="streetsetu-pin streetsetu-pin-selected"></span>',
  iconSize: [24, 32],
  iconAnchor: [12, 30]
});

function MapClickHandler({ onSelect }) {
  useMapEvents({ click: (event) => onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng }) });
  return null;
}

function MapPosition({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 15), { animate: true });
  }, [map, position?.[0], position?.[1]]);
  return null;
}

export default function MapPicker({ latitude, longitude, onChange }) {
  const hasLocation = latitude !== '' && latitude !== null && latitude !== undefined
    && longitude !== '' && longitude !== null && longitude !== undefined
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const position = hasLocation ? [Number(latitude), Number(longitude)] : null;

  return <div className="location-picker">
    <MapContainer center={position || defaultCenter} zoom={position ? 15 : 11} scrollWheelZoom className="complaint-map picker-map">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapClickHandler onSelect={onChange} />
      <MapPosition position={position} />
      {position && <Marker position={position} icon={pinIcon} />}
    </MapContainer>
    <div className="map-hint"><span>⌖</span> Click the map to place the complaint location</div>
  </div>;
}
