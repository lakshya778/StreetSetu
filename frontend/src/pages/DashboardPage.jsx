import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const fallbackStats = { totalComplaints: 0, openComplaints: 0, resolvedComplaints: 0, categoryCounts: [], volunteerPerformance: [] };

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(fallbackStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    api.get('/dashboard/summary')
      .then(({ data }) => { if (mounted) setSummary({ ...fallbackStats, ...data.data }); })
      .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'Analytics are unavailable right now.')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const cards = [
    { label: 'Total complaints', value: summary.totalComplaints, tone: 'ink', mark: '◈' },
    { label: 'Open right now', value: summary.openComplaints, tone: 'amber', mark: '◒' },
    { label: 'Resolved', value: summary.resolvedComplaints, tone: 'green', mark: '✓' }
  ];

  return <div className="dashboard-page"><div className="page-heading"><div><p className="eyebrow">Tuesday, 15 September 2026</p><h1>Good morning, {user?.name?.split(' ')[0] || 'there'}.</h1><p className="page-lede">Here is the pulse of your neighbourhood today.</p></div><button className="outline-button">Export report <span>↓</span></button></div>{error && <div className="notice-banner">{error} <button onClick={() => window.location.reload()}>Retry</button></div>}<div className="stats-grid">{cards.map((card) => <article className={`stat-card ${card.tone}`} key={card.label}><div className="stat-top"><span>{card.label}</span><b>{card.mark}</b></div><strong>{isLoading ? '—' : card.value.toLocaleString()}</strong><small>{card.label === 'Resolved' ? 'Across all reported issues' : 'Across your visible workspace'}</small></article>)}</div><div className="dashboard-grid"><section className="panel category-panel"><div className="panel-heading"><div><p className="eyebrow">Where attention is needed</p><h2>Complaint categories</h2></div><button className="text-button">View all <span>→</span></button></div>{summary.categoryCounts?.length ? <div className="category-list">{summary.categoryCounts.slice(0, 5).map((item, index) => <div className="category-row" key={item.category}><div className="category-name"><span className={`category-bullet bullet-${index}`} />{item.category.replaceAll('_', ' ')}</div><div className="progress-track"><span style={{ width: `${Math.min((item.count / Math.max(summary.totalComplaints, 1)) * 100, 100)}%` }} /></div><strong>{item.count}</strong></div>)}</div> : <div className="empty-state"><span>◌</span><strong>No complaint data yet</strong><p>New reports will appear here as your workspace becomes active.</p></div>}</section><section className="panel pulse-panel"><div className="panel-heading"><div><p className="eyebrow">Service rhythm</p><h2>Resolution pulse</h2></div><span className="live-badge"><i /> Live</span></div><div className="pulse-visual"><div className="pulse-number">{summary.totalComplaints ? `${Math.round((summary.resolvedComplaints / summary.totalComplaints) * 100)}%` : '—'}</div><p>resolution rate</p><div className="mini-chart"><span style={{ height: '35%' }} /><span style={{ height: '51%' }} /><span style={{ height: '43%' }} /><span style={{ height: '68%' }} /><span style={{ height: '58%' }} /><span style={{ height: '82%' }} /><span style={{ height: '74%' }} /><span style={{ height: '94%' }} /></div></div></section></div><section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Team overview</p><h2>Volunteer performance</h2></div><button className="text-button">See details <span>→</span></button></div>{summary.volunteerPerformance?.length ? <div className="table-wrap"><table><thead><tr><th>Volunteer</th><th>Assigned</th><th>Open</th><th>Resolved</th><th>Resolution rate</th></tr></thead><tbody>{summary.volunteerPerformance.slice(0, 5).map((volunteer) => <tr key={String(volunteer.volunteerId)}><td><div className="table-person"><span className="avatar small">{volunteer.volunteerName?.slice(0, 1) || 'V'}</span>{volunteer.volunteerName || 'Unassigned'}</div></td><td>{volunteer.assignedComplaints}</td><td>{volunteer.openComplaints}</td><td>{volunteer.resolvedComplaints}</td><td><span className="rate-pill">{volunteer.resolutionRate}%</span></td></tr>)}</tbody></table></div> : <div className="empty-table">Volunteer performance will populate as complaints are assigned.</div>}</section></div>;
}
