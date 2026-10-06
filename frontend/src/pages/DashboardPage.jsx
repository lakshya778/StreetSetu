import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import RejectedComplaintsTable from '../components/complaints/RejectedComplaintsTable.jsx';
import ComplaintMap from '../components/maps/ComplaintMap.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import AuditActivityPanel from '../components/dashboard/AuditActivityPanel.jsx';
import DuplicateComplaintsPanel from '../components/dashboard/DuplicateComplaintsPanel.jsx';
import HeatmapPanel from '../components/dashboard/HeatmapPanel.jsx';
import GeoAnalyticsCard from '../components/dashboard/GeoAnalyticsCard.jsx';
import HotspotTable from '../components/dashboard/HotspotTable.jsx';
import VolunteerCoverageMap from '../components/maps/VolunteerCoverageMap.jsx';
import AdminAnalyticsDashboard from '../components/dashboard/AdminAnalyticsDashboard.jsx';
import CompletionVerificationPanel from '../components/dashboard/CompletionVerificationPanel.jsx';

const fallbackStats = {
  totalComplaints: 0, openComplaints: 0, resolvedComplaints: 0, rejectedComplaints: 0, rejectionRate: 0,
  topRejectionCategories: [], categoryCounts: [], statusCounts: [], monthlyTrends: [], resolutionTrends: [], volunteerTrends: [], volunteerPerformance: [],
  duplicateComplaints: 0, mergedComplaints: 0, duplicatesPrevented: 0, topDuplicateCategories: [], duplicateSupportCount: 0,
  averageResponseDistanceKm: null, averageTravelDistanceKm: null, complaintsCompletedPerKm: 0, routeEfficiencyScore: 0,
  totalVolunteerWorkload: 0, assignmentEfficiency: 0
};
const STATUS_COLORS = ['#83a978', '#e4aa63', '#7fa8bd', '#9478a5', '#5e896b', '#ad665c', '#d27a70'];

export default function DashboardPage() {
  const { user } = useAuth();
  const { socket } = useNotifications();
  const [summary, setSummary] = useState(fallbackStats);
  const [mapComplaints, setMapComplaints] = useState([]);
  const [geoSummary, setGeoSummary] = useState({ cities: [], areas: [], categories: [], statuses: [], volunteerCoverage: [] });
  const [hotspots, setHotspots] = useState({ topZones: [], reportedAreas: [], resolvedAreas: [], rejectedAreas: [], trend: [], metrics: { heatmapScore: 0, activeHotspotCount: 0 } });
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedVolunteerReport, setSelectedVolunteerReport] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    api.get('/dashboard/summary')
      .then(({ data }) => { if (mounted) setSummary({ ...fallbackStats, ...data.data }); })
      .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'Analytics are unavailable right now.')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    if (user?.role === 'admin') {
      api.get('/complaints/map')
        .then(({ data }) => { if (mounted) setMapComplaints(data.data || []); })
        .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'The city complaints map is unavailable.')); });
      Promise.all([api.get('/analytics/geo-summary'), api.get('/analytics/hotspots')])
        .then(([geoResult, hotspotResult]) => {
          if (mounted) { setGeoSummary(geoResult.data.data); setHotspots(hotspotResult.data.data); }
        })
        .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'Geographic analytics are unavailable right now.')); });
      api.get('/analytics/leaderboard')
        .then(({ data }) => { if (mounted) setLeaderboard(data.data || []); })
        .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'Volunteer rankings are unavailable right now.')); });
    }
    return () => { mounted = false; };
  }, [user?.role]);

  useEffect(() => {
    if (!socket || user?.role !== 'admin') return undefined;
    const refreshDashboard = () => {
      api.get('/dashboard/summary').then(({ data }) => setSummary({ ...fallbackStats, ...data.data })).catch(() => {});
      api.get('/complaints/map').then(({ data }) => setMapComplaints(data.data || [])).catch(() => {});
      api.get('/analytics/geo-summary').then(({ data }) => setGeoSummary(data.data)).catch(() => {});
      api.get('/analytics/hotspots').then(({ data }) => setHotspots(data.data)).catch(() => {});
      api.get('/analytics/leaderboard').then(({ data }) => setLeaderboard(data.data || [])).catch(() => {});
    };
    socket.on('dashboard:updated', refreshDashboard);
    return () => socket.off('dashboard:updated', refreshDashboard);
  }, [socket, user?.role]);

  const cards = [
    { label: 'Total complaints', value: summary.totalComplaints, tone: 'ink', mark: '◈' },
    { label: 'Open right now', value: summary.openComplaints, tone: 'amber', mark: '◒' },
    { label: 'Resolved', value: summary.resolvedComplaints, tone: 'green', mark: '✓' },
    { label: 'Rejected', value: summary.rejectedComplaints, tone: 'red', mark: '×' },
    { label: 'Rejection rate', value: `${summary.rejectionRate}%`, tone: 'rose', mark: '%' }
  ];
  if (user?.role === 'admin') cards.push(
    { label: 'Heatmap score', value: hotspots.metrics.heatmapScore, tone: 'amber', mark: '◉' },
    { label: 'Active hotspots', value: hotspots.metrics.activeHotspotCount, tone: 'red', mark: '⌖' }
  );
  if (user?.role === 'admin') cards.push(
    { label: 'Duplicate reports', value: summary.duplicateComplaints, tone: 'amber', mark: '↔' },
    { label: 'Merged reports', value: summary.mergedComplaints, tone: 'green', mark: '✓' },
    { label: 'Duplicates prevented', value: summary.duplicatesPrevented, tone: 'ink', mark: '⌕' },
    { label: 'Duplicate supporters', value: summary.duplicateSupportCount, tone: 'rose', mark: '♡' },
    { label: 'Average response distance', value: summary.averageResponseDistanceKm == null ? '—' : `${summary.averageResponseDistanceKm} km`, tone: 'ink', mark: '↗' },
    { label: 'Completed per km', value: summary.complaintsCompletedPerKm, tone: 'green', mark: '↗' },
    { label: 'Route efficiency', value: `${summary.routeEfficiencyScore}%`, tone: 'amber', mark: '✓' },
    { label: 'Volunteer workload', value: summary.totalVolunteerWorkload, tone: 'amber', mark: '◷' },
    { label: 'Assignment efficiency', value: `${summary.assignmentEfficiency}%`, tone: 'green', mark: '✓' }
  );

  return <div className="dashboard-page">
    <div className="page-heading"><div><p className="eyebrow">City operations</p><h1>Good morning, {user?.name?.split(' ')[0] || 'there'}.</h1><p className="page-lede">Here is the pulse of your neighbourhood today.</p></div>{user?.role === 'admin' && <div className="report-export-actions"><button className="outline-button" onClick={() => downloadReport('/dashboard/export.csv', 'streetsetu-complaints-report.csv')}>Complaints CSV</button><button className="outline-button" onClick={() => downloadReport('/dashboard/export/volunteers.csv', 'streetsetu-volunteers-report.csv')}>Volunteers CSV</button><button className="outline-button" onClick={() => downloadReport('/dashboard/export/analytics.csv', 'streetsetu-analytics-report.csv')}>Analytics CSV</button><button className="outline-button" onClick={() => downloadReport(`/dashboard/export/monthly.pdf?month=${new Date().toISOString().slice(0, 7)}`, 'streetsetu-monthly-report.pdf')}>Monthly PDF</button><button className="outline-button" onClick={() => downloadReport('/dashboard/export/admin.pdf', 'streetsetu-admin-report.pdf')}>Admin PDF</button><label className="report-volunteer-select"><span>Volunteer PDF</span><select value={selectedVolunteerReport} onChange={(event) => setSelectedVolunteerReport(event.target.value)}><option value="">Select a volunteer</option>{summary.volunteerPerformance.map((volunteer) => <option key={String(volunteer.volunteerId)} value={String(volunteer.volunteerId)}>{volunteer.volunteerName}</option>)}</select></label><button className="outline-button" disabled={!selectedVolunteerReport} onClick={() => downloadReport(`/dashboard/export/volunteer.pdf?volunteerId=${encodeURIComponent(selectedVolunteerReport)}`, 'streetsetu-volunteer-report.pdf')}>Export volunteer</button></div>}</div>
    {error && <div className="notice-banner">{error} <button onClick={() => window.location.reload()}>Retry</button></div>}
    <div className="stats-grid rejection-stats-grid">{cards.map((card) => <article className={`stat-card ${card.tone}`} key={card.label}><div className="stat-top"><span>{card.label}</span><b>{card.mark}</b></div><strong>{isLoading ? '—' : typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</strong><small>{card.label === 'Rejection rate' ? 'Rejected / all complaints' : 'Across your visible workspace'}</small></article>)}</div>
    {user?.role === 'admin' && <section className="panel dashboard-map-panel"><div className="panel-heading"><div><p className="eyebrow">City-wide view</p><h2>Complaint map</h2></div></div><ComplaintMap complaints={mapComplaints} className="dashboard-city-map" /></section>}
    {user?.role === 'admin' && <HeatmapPanel />}
    {user?.role === 'admin' && <GeoAnalyticsCard summary={geoSummary} hotspots={hotspots} />}
    {user?.role === 'admin' && <VolunteerCoverageMap volunteers={geoSummary.volunteerCoverage} />}
    {user?.role === 'admin' && <HotspotTable hotspots={hotspots} />}
    {user?.role === 'admin' && <section className="panel top-volunteers-card"><div className="panel-heading"><div><p className="eyebrow">Community impact</p><h2>Top volunteers</h2></div><span className="leaderboard-score-note">Weighted performance score / 100</span></div>{leaderboard.length ? <div className="table-wrap"><table><thead><tr><th>Rank</th><th>Volunteer</th><th>Score</th><th>Resolved</th><th>Rating</th><th>Acceptance</th></tr></thead><tbody>{leaderboard.slice(0, 5).map((volunteer) => <tr key={String(volunteer.volunteerId)}><td>{volunteer.rank}</td><td>{volunteer.volunteerName}<small className="leaderboard-area">{[volunteer.area, volunteer.city].filter(Boolean).join(', ')}</small></td><td><strong className="leaderboard-score">{volunteer.score}</strong></td><td>{volunteer.resolvedComplaints}</td><td>{volunteer.averageRating == null ? '—' : `${volunteer.averageRating} / 5`}</td><td>{volunteer.assignmentAcceptanceRate}%</td></tr>)}</tbody></table></div> : <div className="empty-table">Volunteer scores will appear after assignments and citizen feedback are recorded.</div>}</section>}
    {user?.role === 'admin' && <AdminAnalyticsDashboard />}
    {user?.role !== 'admin' && <div className="dashboard-grid dashboard-analytics-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">Issue mix</p><h2>Complaints by category</h2></div></div><div className="dashboard-chart">{summary.categoryCounts.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={summary.categoryCounts}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="category" tickFormatter={(value) => value.replaceAll('_', ' ')} interval={0} angle={-15} textAnchor="end" height={55} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="Complaints" fill="#83a978" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="chart-empty">No complaint data yet.</div>}</div></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">Lifecycle</p><h2>Complaints by status</h2></div></div><div className="dashboard-chart status-chart">{summary.statusCounts.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary.statusCounts} dataKey="count" nameKey="status" innerRadius="48%" outerRadius="75%" paddingAngle={2} label={({ name, percent }) => `${name.replaceAll('_', ' ')} ${(percent * 100).toFixed(0)}%`}>{summary.statusCounts.map((item, index) => <Cell key={item.status} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <div className="chart-empty">No complaint data yet.</div>}</div></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">Monthly activity</p><h2>Reports submitted</h2></div></div><div className="dashboard-chart">{summary.monthlyTrends.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={summary.monthlyTrends}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Area type="monotone" dataKey="submitted" name="Submitted" stroke="#83a978" fill="#dcebd6" /><Area type="monotone" dataKey="rejected" name="Rejected" stroke="#d27a70" fill="#f8e2de" /></AreaChart></ResponsiveContainer> : <div className="chart-empty">Monthly activity will appear here.</div>}</div></section>
    </div>}
    <div className="dashboard-grid">
      <section className="panel rejection-category-panel"><div className="panel-heading"><div><p className="eyebrow">Review patterns</p><h2>Top rejection categories</h2></div><span className="rejection-badge">{summary.rejectedComplaints} rejected</span></div>{summary.topRejectionCategories.length ? <div className="rejection-category-list">{summary.topRejectionCategories.map((item, index) => <div className="rejection-category-row" key={item.category}><span className="rejection-rank">0{index + 1}</span><span>{item.category.replaceAll('_', ' ')}</span><strong>{item.count}</strong></div>)}</div> : <div className="empty-state compact-empty"><strong>No rejected complaints</strong><p>Rejection patterns will appear here.</p></div>}</section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Service rhythm</p><h2>Overall resolution rate</h2></div></div><div className="dashboard-resolution-number">{summary.totalComplaints ? `${Math.round((summary.resolvedComplaints / summary.totalComplaints) * 100)}%` : '—'}</div><p className="page-lede">Resolved complaints divided by total complaints.</p></section>
    </div>
    <section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Volunteer performance</p><h2>Volunteer leaderboard</h2></div></div>{summary.volunteerPerformance.length ? <><div className="leaderboard-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.volunteerPerformance.slice(0, 8)} layout="vertical" margin={{ left: 30 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="volunteerName" width={100} /><Tooltip /><Bar dataKey="resolvedComplaints" name="Resolved" fill="#5e896b" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Volunteer</th><th>Assigned</th><th>Active</th><th>Resolved</th><th>Average completion</th><th>Resolution rate</th></tr></thead><tbody>{summary.volunteerPerformance.slice(0, 8).map((volunteer, index) => <tr key={String(volunteer.volunteerId)}><td>{index + 1}</td><td>{volunteer.volunteerName || 'Volunteer'}</td><td>{volunteer.assignedComplaints}</td><td>{volunteer.openComplaints}</td><td>{volunteer.resolvedComplaints}</td><td>{volunteer.averageCompletionDays == null ? '—' : `${volunteer.averageCompletionDays} days`}</td><td><span className="rate-pill">{volunteer.resolutionRate}%</span></td></tr>)}</tbody></table></div></> : <div className="empty-table">Volunteer performance will populate as complaints are assigned.</div>}</section>
    {user?.role === 'admin' && <RejectedComplaintsTable />}
    {user?.role === 'admin' && <DuplicateComplaintsPanel topCategories={summary.topDuplicateCategories} />}
    {user?.role === 'admin' && <CompletionVerificationPanel />}
    {user?.role === 'admin' && <AuditActivityPanel />}
  </div>;
}

async function downloadReport(path, fileName) {
  const { data } = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
