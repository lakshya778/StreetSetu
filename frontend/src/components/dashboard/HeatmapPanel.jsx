import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import api, { getApiErrorMessage } from '../../api/client.js';
import { complaintCategories } from '../../api/complaints.js';

function HeatLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'leaflet-heat-canvas';
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '350' });
    map.getContainer().appendChild(canvas);
    const context = canvas.getContext('2d');
    const draw = () => {
      const size = map.getSize();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = size.x * ratio;
      canvas.height = size.y * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size.x, size.y);
      for (const point of points) {
        const pixel = map.latLngToContainerPoint([point.latitude, point.longitude]);
        const radius = Math.max(22, Math.min(42, 22 + point.intensity * 20));
        const gradient = context.createRadialGradient(pixel.x, pixel.y, 1, pixel.x, pixel.y, radius);
        gradient.addColorStop(0, 'rgba(196, 64, 47, 0.78)');
        gradient.addColorStop(0.35, 'rgba(241, 151, 62, 0.48)');
        gradient.addColorStop(0.7, 'rgba(247, 218, 89, 0.22)');
        gradient.addColorStop(1, 'rgba(247, 218, 89, 0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
        context.fill();
      }
    };
    map.on('move zoom resize', draw);
    const observer = new ResizeObserver(draw);
    observer.observe(map.getContainer());
    draw();
    return () => { observer.disconnect(); map.off('move zoom resize', draw); canvas.remove(); };
  }, [map, points]);
  return null;
}

const initialFilters = { category: '', status: '', from: '', to: '' };

function HeatmapViewport({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.setView([points[0].latitude, points[0].longitude], Math.max(map.getZoom(), 11));
  }, [map, points]);
  return null;
}

export default function HeatmapPanel() {
  const [filters, setFilters] = useState(initialFilters);
  const [points, setPoints] = useState([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    if (params.to) params.to = `${params.to}T23:59:59.999Z`;
    setLoading(true);
    api.get('/analytics/heatmap', { params })
      .then(({ data }) => { if (mounted) { setPoints(data.data.points || []); setCount(data.data.count || 0); setError(''); } })
      .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'The complaint heatmap could not be loaded.')); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [filters]);

  function updateFilter(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })); }

  return <section className="panel geo-heatmap-panel">
    <div className="panel-heading"><div><p className="eyebrow">Geographic intelligence</p><h2>Complaint heatmap</h2><p className="page-lede">Warmer zones show where reports are concentrated.</p></div><span className="heatmap-count">{loading ? 'Loading…' : `${count.toLocaleString()} reports`}</span></div>
    <div className="heatmap-filters">
      <label>Category<select name="category" value={filters.category} onChange={updateFilter}><option value="">All categories</option>{complaintCategories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></label>
      <label>Status<select name="status" value={filters.status} onChange={updateFilter}><option value="">All statuses</option>{['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
      <label>From<input type="date" name="from" value={filters.from} onChange={updateFilter} /></label>
      <label>To<input type="date" name="to" value={filters.to} onChange={updateFilter} /></label>
    </div>
    {error && <div className="notice-banner" role="alert">{error}</div>}
    <div className="geo-heatmap-shell"><MapContainer center={[28.6139, 77.209]} zoom={11} scrollWheelZoom className="geo-heatmap-map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><HeatmapViewport points={points} /><HeatLayer points={points} /></MapContainer></div>
    <div className="heatmap-legend"><span><i /> Lower density</span><span><i /> Higher density</span><small>All matching complaints are represented in aggregated map zones</small></div>
  </section>;
}
