import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import PageHeader from '../components/layout/PageHeader.jsx';
import { statusLabel } from '../components/complaints/ComplaintCard.jsx';
const AdminOperationsDashboard = lazy(() => import('../components/dashboard/AdminOperationsDashboard.jsx'));

const emptySummary = {
  totalComplaints: 0, openComplaints: 0, resolvedComplaints: 0, rejectedComplaints: 0, rejectionRate: 0,
  topRejectionCategories: [], categoryCounts: [], statusCounts: [], monthlyTrends: [], volunteerPerformance: []
};
const STATUS_COLORS = ['#83a978', '#e4aa63', '#7fa8bd', '#9478a5', '#5e896b', '#ad665c', '#d27a70'];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (user?.role === 'admin') return <Suspense fallback={<div className="page-skeleton" role="status" aria-label={t('dashboard.loading')}><span /><span /><span /></div>}><AdminOperationsDashboard /></Suspense>;
  return <CommunityDashboard user={user} />;
}

function CommunityDashboard({ user }) {
  const { t } = useTranslation();
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
    { label: t('dashboard.totalComplaints'), value: summary.totalComplaints, tone: 'ink', mark: '◈' },
    { label: t('dashboard.openNow'), value: summary.openComplaints, tone: 'amber', mark: '◒' },
    { label: t('dashboard.resolved'), value: summary.resolvedComplaints, tone: 'green', mark: '✓' },
    { label: t('dashboard.rejected'), value: summary.rejectedComplaints, tone: 'red', mark: '×' }
  ];

  return <div className="dashboard-page">
    <PageHeader kicker={t('dashboard.communityKicker')} title={t('dashboard.greeting', { name: user?.name?.split(' ')[0] || t('dashboard.greetingFallback') })} subtitle={t('dashboard.communitySubtitle')} />
    {error && <div className="notice-banner">{error}</div>}
    <div className="stats-grid rejection-stats-grid">{cards.map((card) => <article className={`stat-card ${card.tone}`} key={card.label}><div className="stat-top"><span>{card.label}</span><b>{card.mark}</b></div><strong>{isLoading ? '—' : card.value.toLocaleString()}</strong><small>{card.label === t('dashboard.rejected') ? t('dashboard.rejectionRate', { rate: summary.rejectionRate }) : t('dashboard.visibleWorkspace')}</small></article>)}</div>
    <div className="dashboard-grid dashboard-analytics-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">{t('dashboard.issueMix')}</p><h2>{t('dashboard.byCategory')}</h2></div></div><div className="dashboard-chart">{summary.categoryCounts.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={summary.categoryCounts}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="category" tickFormatter={(value) => t(`category.${value}`, { defaultValue: value.replaceAll('_', ' ') })} interval={0} angle={-15} textAnchor="end" height={55} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name={t('dashboard.complaints')} fill="#83a978" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="chart-empty">{t('dashboard.noComplaintData')}</div>}</div></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">{t('dashboard.lifecycle')}</p><h2>{t('dashboard.byStatus')}</h2></div></div><div className="dashboard-chart status-chart">{summary.statusCounts.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary.statusCounts} dataKey="count" nameKey="status" innerRadius="48%" outerRadius="75%" paddingAngle={2} label={({ name, percent }) => `${statusLabel(name)} ${(percent * 100).toFixed(0)}%`}>{summary.statusCounts.map((item, index) => <Cell key={item.status} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <div className="chart-empty">{t('dashboard.noComplaintData')}</div>}</div></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">{t('dashboard.monthlyActivity')}</p><h2>{t('dashboard.reportsSubmitted')}</h2></div></div><div className="dashboard-chart">{summary.monthlyTrends.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={summary.monthlyTrends}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Area type="monotone" dataKey="submitted" name={t('dashboard.submitted')} stroke="#83a978" fill="#dcebd6" /><Area type="monotone" dataKey="rejected" name={t('dashboard.rejected')} stroke="#d27a70" fill="#f8e2de" /></AreaChart></ResponsiveContainer> : <div className="chart-empty">{t('dashboard.monthlyEmpty')}</div>}</div></section>
    </div>
    <div className="dashboard-grid">
      <section className="panel rejection-category-panel"><div className="panel-heading"><div><p className="eyebrow">{t('dashboard.reviewPatterns')}</p><h2>{t('dashboard.topRejectionCategories')}</h2></div><span className="rejection-badge">{t('dashboard.rejectionCount', { count: summary.rejectedComplaints })}</span></div>{summary.topRejectionCategories.length ? <div className="rejection-category-list">{summary.topRejectionCategories.map((item, index) => <div className="rejection-category-row" key={item.category}><span className="rejection-rank">0{index + 1}</span><span>{t(`category.${item.category}`, { defaultValue: item.category.replaceAll('_', ' ') })}</span><strong>{item.count}</strong></div>)}</div> : <div className="empty-state compact-empty"><strong>{t('dashboard.noRejected')}</strong><p>{t('dashboard.rejectionEmpty')}</p></div>}</section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">{t('dashboard.serviceRhythm')}</p><h2>{t('dashboard.resolutionRate')}</h2></div></div><div className="dashboard-resolution-number">{summary.totalComplaints ? `${Math.round((summary.resolvedComplaints / summary.totalComplaints) * 100)}%` : '—'}</div><p className="page-lede">{t('dashboard.resolutionRateHelp')}</p></section>
    </div>
    <section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">{t('dashboard.volunteerPerformance')}</p><h2>{t('dashboard.leaderboard')}</h2></div></div>{summary.volunteerPerformance.length ? <><div className="leaderboard-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.volunteerPerformance.slice(0, 8)} layout="vertical" margin={{ left: 30 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="volunteerName" width={100} /><Tooltip /><Bar dataKey="resolvedComplaints" name={t('dashboard.resolved')} fill="#5e896b" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div><div className="table-wrap"><table><thead><tr><th>{t('dashboard.rank')}</th><th>{t('dashboard.volunteer')}</th><th>{t('dashboard.assigned')}</th><th>{t('dashboard.active')}</th><th>{t('dashboard.resolved')}</th><th>{t('dashboard.averageCompletion')}</th><th>{t('dashboard.resolutionRate')}</th></tr></thead><tbody>{summary.volunteerPerformance.slice(0, 8).map((volunteer, index) => <tr key={String(volunteer.volunteerId)}><td>{index + 1}</td><td>{volunteer.volunteerName || t('dashboard.volunteer')}</td><td>{volunteer.assignedComplaints}</td><td>{volunteer.openComplaints}</td><td>{volunteer.resolvedComplaints}</td><td>{volunteer.averageCompletionDays == null ? '—' : t('dashboard.days', { count: volunteer.averageCompletionDays })}</td><td><span className="rate-pill">{volunteer.resolutionRate}%</span></td></tr>)}</tbody></table></div></> : <div className="empty-table">{t('dashboard.volunteerEmpty')}</div>}</section>
  </div>;
}
