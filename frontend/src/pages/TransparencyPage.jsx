import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { getPublicTransparency } from '../api/public.js';
import PublicHeader from '../components/layout/PublicHeader.jsx';

const emptySummary = { totalComplaints: 0, resolvedComplaints: 0, activeComplaints: 0, rejectedComplaints: 0, resolutionRate: 0, averageResolutionDays: null, topCategories: [], heatmapSummary: [], mostActiveAreas: [] };

export default function TransparencyPage() {
  const [summary, setSummary] = useState(emptySummary);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPublicTransparency().then((data) => { if (active) setSummary({ ...emptySummary, ...data }); })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Transparency information could not be loaded.')); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const metrics = [
    ['Total complaints', summary.totalComplaints], ['Resolved', summary.resolvedComplaints],
    ['Active', summary.activeComplaints], ['Rejected', summary.rejectedComplaints],
    ['Resolution rate', `${summary.resolutionRate}%`],
    ['Average resolution time', summary.averageResolutionDays == null ? '—' : `${summary.averageResolutionDays} days`]
  ];

  return <div className="public-page"><PublicHeader /><main className="public-content">
    <section className="public-hero"><p className="eyebrow">Open civic service data</p><h1>See how your city is responding.</h1><p>Complaint counts and resolution progress, published for everyone to follow.</p><Link className="primary-button" to="/login">Report a civic issue <span>→</span></Link></section>
    {error && <div className="notice-banner" role="alert">{error} <button onClick={() => window.location.reload()}>Retry</button></div>}
    <section className="public-metrics-grid">{metrics.map(([label, value]) => <article className="public-metric-card" key={label}><span>{label}</span><strong>{isLoading ? '—' : typeof value === 'number' ? value.toLocaleString() : value}</strong></article>)}</section>
    <div className="public-data-grid">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Issue mix</p><h2>Top complaint categories</h2></div></div>{summary.topCategories.length ? <div className="public-ranking-list">{summary.topCategories.map((item, index) => <div className="public-ranking-row" key={item.category}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.category.replaceAll('_', ' ')}</strong><b>{item.count}</b></div>)}</div> : <p className="nearby-panel-message">{isLoading ? 'Loading categories…' : 'No reports yet.'}</p>}</section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Neighbourhood activity</p><h2>Most active areas</h2></div></div>{summary.mostActiveAreas.length ? <div className="public-ranking-list">{summary.mostActiveAreas.map((item, index) => <div className="public-ranking-row" key={item.area}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.area}</strong><b>{item.count}</b></div>)}</div> : <p className="nearby-panel-message">{isLoading ? 'Loading areas…' : 'Area data will appear as reports arrive.'}</p>}</section>
      <section className="panel public-heatmap-summary"><div className="panel-heading"><div><p className="eyebrow">Geographic snapshot</p><h2>Complaint heatmap summary</h2></div></div>{summary.heatmapSummary.length ? <div className="public-ranking-list">{summary.heatmapSummary.map((zone, index) => <div className="public-ranking-row" key={`${zone.latitude}-${zone.longitude}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>Zone {zone.latitude.toFixed(2)}, {zone.longitude.toFixed(2)}</strong><b>{zone.count}</b></div>)}</div> : <p className="nearby-panel-message">{isLoading ? 'Loading location summary…' : 'No mapped complaints yet.'}</p>}<small>Zones are rounded to protect precise complaint locations.</small></section>
    </div>
    <section className="public-track-cta"><div><p className="eyebrow">Already have a report?</p><h2>Follow its progress</h2><p>Open the tracking link shared after submission or in your email updates.</p></div><Link className="outline-button" to="/login">View my complaints</Link></section>
  </main></div>;
}
