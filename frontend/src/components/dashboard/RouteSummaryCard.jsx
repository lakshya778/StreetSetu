import { Link } from 'react-router-dom';

function formatDuration(minutes) {
  if (!minutes) return 'Under 1 min';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} hr ${remainder} min` : `${minutes} min`;
}

export default function RouteSummaryCard({ route, isLoading = false }) {
  const stops = route?.assignments || [];
  return <section className="panel route-summary-card">
    <div className="panel-heading"><div><p className="eyebrow">Today’s field plan</p><h2>Optimized visit order</h2></div><span className="route-stop-count">{stops.length} stop{stops.length === 1 ? '' : 's'}</span></div>
    <div className="route-summary-metrics"><div><span>Route distance</span><strong>{route?.totalDistanceKm ?? 0} km</strong></div><div><span>Estimated travel</span><strong>{formatDuration(route?.estimatedTravelMinutes || 0)}</strong></div></div>
    {isLoading ? <div className="empty-table">Planning today’s assignments…</div> : stops.length ? <ol className="optimized-assignment-list">{stops.map((item) => <li key={item._id}><span className="route-order">{String(item.routeOrder).padStart(2, '0')}</span><div><Link to={`/dashboard/complaints/${item.complaint._id}`}>{item.complaint.title}</Link><small>{item.complaint.address || item.complaint.category?.replaceAll('_', ' ')}{item.legDistanceKm == null ? '' : ` · ${item.legDistanceKm} km from previous stop`}</small></div></li>)}</ol> : <p className="nearby-panel-message">No assignments scheduled for today.</p>}
    <small className="route-estimate-note">Straight-line distance in nearest-stop order; walking time estimated at 4.5 km/h.</small>
  </section>;
}
