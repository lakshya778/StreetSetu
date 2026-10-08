import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import ImageGallery from '../media/ImageGallery.jsx';
import 'leaflet/dist/leaflet.css';

const defaultCenter = [28.6139, 77.2090];
const pinIcon = L.divIcon({
  className: 'streetsetu-pin-wrapper',
  html: '<span class="streetsetu-pin"></span>',
  iconSize: [24, 32],
  iconAnchor: [12, 30]
});
const duplicatePinIcon = L.divIcon({
  className: 'streetsetu-pin-wrapper streetsetu-pin-wrapper-duplicate',
  html: '<span class="streetsetu-pin streetsetu-pin-duplicate"></span>',
  iconSize: [26, 34],
  iconAnchor: [13, 32]
});

function createClusterIcon(cluster) {
  const count = cluster.getChildCount();
  const duplicateCount = cluster.getAllChildMarkers().filter((marker) => marker.options.streetsetuDuplicate).length;
  const size = count >= 100 ? 'large' : count >= 10 ? 'medium' : 'small';
  const duplicateBadge = duplicateCount ? `<span class="complaint-cluster-duplicates" title="${duplicateCount} possible duplicate reports">${duplicateCount} dup</span>` : '';
  return L.divIcon({
    html: `<span class="complaint-cluster-count">${count}</span>${duplicateBadge}`,
    className: `complaint-cluster complaint-cluster-${size}${duplicateCount ? ' complaint-cluster-has-duplicates' : ''}`,
    iconSize: L.point(46, 46)
  });
}

function coordinatesFor(complaint) {
  if (!complaint || typeof complaint !== 'object') return null;
  const latitude = Number(complaint.latitude ?? complaint.location?.coordinates?.[1]);
  const longitude = Number(complaint.longitude ?? complaint.location?.coordinates?.[0]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null;
}

function ComplaintMap({ complaints = [], className = '' }) {
  const points = useMemo(() => (Array.isArray(complaints) ? complaints : []).filter(Boolean).map((complaint) => ({
    complaint,
    position: coordinatesFor(complaint),
    isDuplicate: Boolean(complaint.isDuplicate || complaint.duplicateOf || complaint.masterComplaint || complaint.duplicateScore > 0)
  })).filter((item) => item.position && item.complaint?._id), [complaints]);
  const center = points[0]?.position || defaultCenter;

  return <div className={`complaint-map-shell ${className}`}>
    <MapContainer center={center} zoom={points.length ? 12 : 11} scrollWheelZoom className="complaint-map">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterIcon} showCoverageOnHover={false} spiderfyOnMaxZoom zoomToBoundsOnClick removeOutsideVisibleBounds disableClusteringAtZoom={17} animate={false}>
        {points.map(({ complaint, position, isDuplicate }) => <Marker key={complaint._id} position={position} icon={isDuplicate ? duplicatePinIcon : pinIcon} streetsetuDuplicate={isDuplicate}>
          <Popup>
            <div className={`map-popup-content${isDuplicate ? ' map-popup-duplicate' : ''}`}><strong>{complaint.title}</strong>{complaint.address && <span className="map-popup-address">{complaint.address}</span>}<span className="map-popup-status">{complaint.status?.replaceAll('_', ' ')}</span>{isDuplicate && <span className="map-duplicate-badge">Possible duplicate · {complaint.duplicateScore || 0}% match</span>}
              <ImageGallery images={(Array.isArray(complaint.attachments) ? complaint.attachments : []).slice(0, 4)} label="Complaint photos" compact />
              <Link to={`/dashboard/complaints/${complaint._id}`}>View complaint</Link>
            </div>
          </Popup>
        </Marker>)}
      </MarkerClusterGroup>
    </MapContainer>
    <div className="map-legend"><span className="legend-dot" /> {points.length} mapped complaint{points.length === 1 ? '' : 's'} <span className="legend-separator" /><span className="legend-cluster-sample">{Math.min(points.length, 9)}</span> nearby reports <span className="legend-separator" /><span className="legend-duplicate-dot" /> possible duplicate</div>
  </div>;
}

export default memo(ComplaintMap);
