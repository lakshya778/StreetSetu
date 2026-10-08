import { lazy, Suspense, useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
const AdminOperationsDashboard = lazy(() => import('../components/dashboard/AdminOperationsDashboard.jsx'));

const emptySummary = {
  totalComplaints: 0, openComplaints: 0, resolvedComplaints: 0, rejectedComplaints: 0, rejectionRate: 0,
  topRejectionCategories: [], categoryCounts: [], statusCounts: [], monthlyTrends: [], volunteerPerformance: []
};
const STATUS_COLORS = ['#83a978', '#e4aa63', '#7fa8bd', '#9478a5', '#5e896b', '#ad665c', '#d27a70'];

export default function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Suspense fallback={<div className="page-skeleton" role="status" aria-label="Loading admin dashboard"><span /><span /><span /></div>}><AdminOperationsDashboard /></Suspense>;
  return <CommunityDashboard user={user} />;
}

function CommunityDashboard({ user }) {
  const { socket } = useNotifications();
  const [summary, setSummary] = useState(emptySummary);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = () => api.get('/dashboard/summary')
      .then(({ data }) => { if (mounted) { setSummary({ ...emptySummary, ...data.data }); setError(''); } })
      .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'Dashboard information is unavailable right now.')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => api.get('/dashboard/summary')
      .then(({ data }) => setSummary({ ...emptySummary, ...data.data }))
      .catch(() => {});
    socket.on('dashboard:updated', refresh);
    return () => socket.off('dashboard:updated', refresh);
  }, [socket]);

  const cards = [
    { label: 'Total complaints', value: summary.totalComplaints, tone: 'ink', mark: '◈' },
    { label: 'Open right now', value: summary.openComplaints, tone: 'amber', mark: '◒' },
    { label: 'Resolved', value: summary.resolvedComplaints, tone: 'green', mark: '✓' },
    { label: 'Rejected', value: summary.rejectedComplaints, tone: 'red', mark: '×' },
    { label: 'Rejection rate', value: `${summary.rejectionRate}%`, tone: 'rose', mark: '%' }
  ];

  return <div className="dashboard-page">
    <div className="page-heading"><div><p className="eyebrow">Community dashboard</p><h1>Good morning, {user?.name?.split(' ')[0] || 'there'}.</h1><p className="page-lede">Here is the pulse of your neighbourhood today.</p></div></div>
    {error && <div className="notice-banner">{error}</div>}
    <div className="stats-grid rejection-stats-grid">{cards.map((card) => <article className={`stat-card ${card.tone}`} key={card.label}><div className="stat-top"><span>{card.label}</span><b>{card.mark}</b></div><strong>{isLoading ? '—' : typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</strong><small>{card.label === 'Rejection rate' ? 'Rejected / all complaints' : 'Across your visible workspace'}</small></article>)}</div>
    <div className="dashboard-grid dashboard-analytics-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">Issue mix</p><h2>Complaints by category</h2></div></div><div className="dashboard-chart">{summary.categoryCounts.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={summary.categoryCounts}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="category" tickFormatter={(value) => value.replaceAll('_', ' ')} interval={0} angle={-15} textAnchor="end" height={55} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="Complaints" fill="#83a978" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="chart-empty">No complaint data yet.</div>}</div></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">Lifecycle</p><h2>Complaints by status</h2></div></div><div className="dashboard-chart status-chart">{summary.statusCounts.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary.statusCounts} dataKey="count" nameKey="status" innerRadius="48%" outerRadius="75%" paddingAngle={2} label={({ name, percent }) => `${name.replaceAll('_', ' ')} ${(percent * 100).toFixed(0)}%`}>{summary.statusCounts.map((item, index) => <Cell key={item.status} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <div className="chart-empty">No complaint data yet.</div>}</div></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">Monthly activity</p><h2>Reports submitted</h2></div></div><div className="dashboard-chart">{summary.monthlyTrends.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={summary.monthlyTrends}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Area type="monotone" dataKey="submitted" name="Submitted" stroke="#83a978" fill="#dcebd6" /><Area type="monotone" dataKey="rejected" name="Rejected" stroke="#d27a70" fill="#f8e2de" /></AreaChart></ResponsiveContainer> : <div className="chart-empty">Monthly activity will appear here.</div>}</div></section>
    </div>
    <div className="dashboard-grid">
      <section className="panel rejection-category-panel"><div className="panel-heading"><div><p className="eyebrow">Review patterns</p><h2>Top rejection categories</h2></div><span className="rejection-badge">{summary.rejectedComplaints} rejected</span></div>{summary.topRejectionCategories.length ? <div className="rejection-category-list">{summary.topRejectionCategories.map((item, index) => <div className="rejection-category-row" key={item.category}><span className="rejection-rank">0{index + 1}</span><span>{item.category.replaceAll('_', ' ')}</span><strong>{item.count}</strong></div>)}</div> : <div className="empty-state compact-empty"><strong>No rejected complaints</strong><p>Rejection patterns will appear here.</p></div>}</section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Service rhythm</p><h2>Overall resolution rate</h2></div></div><div className="dashboard-resolution-number">{summary.totalComplaints ? `${Math.round((summary.resolvedComplaints / summary.totalComplaints) * 100)}%` : '—'}</div><p className="page-lede">Resolved complaints divided by total complaints.</p></section>
    </div>
    <section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Volunteer performance</p><h2>Volunteer leaderboard</h2></div></div>{summary.volunteerPerformance.length ? <><div className="leaderboard-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.volunteerPerformance.slice(0, 8)} layout="vertical" margin={{ left: 30 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="volunteerName" width={100} /><Tooltip /><Bar dataKey="resolvedComplaints" name="Resolved" fill="#5e896b" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Volunteer</th><th>Assigned</th><th>Active</th><th>Resolved</th><th>Average completion</th><th>Resolution rate</th></tr></thead><tbody>{summary.volunteerPerformance.slice(0, 8).map((volunteer, index) => <tr key={String(volunteer.volunteerId)}><td>{index + 1}</td><td>{volunteer.volunteerName || 'Volunteer'}</td><td>{volunteer.assignedComplaints}</td><td>{volunteer.openComplaints}</td><td>{volunteer.resolvedComplaints}</td><td>{volunteer.averageCompletionDays == null ? '—' : `${volunteer.averageCompletionDays} days`}</td><td><span className="rate-pill">{volunteer.resolutionRate}%</span></td></tr>)}</tbody></table></div></> : <div className="empty-table">Volunteer performance will populate as complaints are assigned.</div>}</section>
  </div>;
}
