import { useCallback, useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { getApiErrorMessage } from '../../api/client.js';

const initialData = { overview: null, categories: [], areas: [], resolutionTrend: { days: [], totalResolved: 0 }, leaderboard: [] };
const endpoints = [
  ['overview', '/analytics/overview'],
  ['categories', '/analytics/categories'],
  ['areas', '/analytics/areas'],
  ['resolutionTrend', '/analytics/resolution-trend'],
  ['leaderboard', '/analytics/leaderboard?limit=10']
];

export default function AdminAnalyticsDashboard() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled(endpoints.map(([, path]) => api.get(path)));
    const nextErrors = {};
    setData((current) => {
      const next = { ...current };
      results.forEach((result, index) => {
        const [key] = endpoints[index];
        if (result.status === 'fulfilled') next[key] = result.value.data.data;
        else nextErrors[key] = getApiErrorMessage(result.reason, 'This analytics view could not be loaded.');
      });
      return next;
    });
    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const overview = data.overview || {};
  const cards = [
    { label: 'Total complaints', value: overview.totalComplaints, tone: 'ink', mark: '◈' },
    { label: 'Open complaints', value: overview.openComplaints, tone: 'amber', mark: '◒' },
    { label: 'Resolved complaints', value: overview.resolvedComplaints, tone: 'green', mark: '✓' },
    { label: 'Resolution rate', value: `${overview.resolutionRate ?? 0}%`, tone: 'ink', mark: '%' }
  ];

  return <section className="admin-analytics-section">
    <div className="panel-heading admin-analytics-heading"><div><p className="eyebrow">Operational insights</p><h2>Advanced analytics</h2><p className="page-lede">Complaint patterns, service progress, and volunteer impact.</p></div>{Object.keys(errors).length > 0 && <button className="outline-button" onClick={loadAnalytics} disabled={loading}>{loading ? 'Refreshing…' : 'Retry analytics'}</button>}</div>
    {Object.entries(errors).map(([key, message]) => <div className="notice-banner analytics-error" key={key}><strong>{labelFor(key)}:</strong> {message}</div>)}
    <div className="stats-grid admin-analytics-kpis">{cards.map((card) => <article className={`stat-card ${card.tone}`} key={card.label}><div className="stat-top"><span>{card.label}</span><b>{card.mark}</b></div><strong>{loading && !overview.totalComplaints ? '…' : errors.overview ? '—' : typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</strong><small>Across all reported complaints</small></article>)}</div>
    <div className="dashboard-grid dashboard-analytics-grid admin-analytics-charts">
      <ChartPanel eyebrow="Issue mix" title="Complaints by category" loading={loading && !data.categories.length} error={errors.categories} empty={!data.categories.length} emptyText="No categorized complaints yet.">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={data.categories} margin={{ bottom: 25 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="category" tickFormatter={formatLabel} interval={0} angle={-18} textAnchor="end" height={55} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="Complaints" fill="#83a978" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>
      </ChartPanel>
      <ChartPanel eyebrow="Neighbourhoods" title="Complaints by area" loading={loading && !data.areas.length} error={errors.areas} empty={!data.areas.length} emptyText="Area statistics will appear when complaints include an area.">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={data.areas.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="area" width={105} tickFormatter={shorten} /><Tooltip /><Bar dataKey="count" name="Complaints" fill="#7fa8bd" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
      </ChartPanel>
      <ChartPanel eyebrow="Last 30 days" title="Resolution trend" loading={loading && !data.resolutionTrend.days?.length} error={errors.resolutionTrend} empty={!data.resolutionTrend.days?.length} emptyText="Resolution activity will appear here.">
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.resolutionTrend.days}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" interval={4} /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="resolved" name="Resolved complaints" stroke="#5e896b" fill="#dcebd6" /></AreaChart></ResponsiveContainer>
      </ChartPanel>
      <ChartPanel eyebrow="Community impact" title="Volunteer performance" loading={loading && !data.leaderboard.length} error={errors.leaderboard} empty={!data.leaderboard.length} emptyText="Volunteer rankings will appear after performance data is available.">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={data.leaderboard.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 14 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="volunteerName" width={105} tickFormatter={shorten} /><Tooltip formatter={(value) => [`${value} / 100`, 'Performance score']} /><Bar dataKey="score" name="Performance score" fill="#d3b66f" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
      </ChartPanel>
    </div>
  </section>;
}

function ChartPanel({ eyebrow, title, loading, error, empty, emptyText, children }) {
  return <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div><div className="dashboard-chart admin-analytics-chart">{loading ? <div className="chart-empty" role="status">Loading {title.toLowerCase()}…</div> : error ? <div className="chart-empty analytics-chart-error">{error}</div> : empty ? <div className="chart-empty">{emptyText}</div> : children}</div></section>;
}

function labelFor(key) { return ({ overview: 'Overview', categories: 'Categories', areas: 'Areas', resolutionTrend: 'Resolution trend', leaderboard: 'Volunteer performance' })[key] || 'Analytics'; }
function formatLabel(value) { return String(value || '').replaceAll('_', ' '); }
function shorten(value) { const label = String(value || ''); return label.length > 15 ? `${label.slice(0, 14)}…` : label; }
