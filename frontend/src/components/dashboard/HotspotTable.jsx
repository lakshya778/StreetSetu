import { useState } from 'react';

const views = [
  { key: 'topZones', label: 'Top 10 zones' },
  { key: 'categoryHotspots', label: 'Category hotspots' },
  { key: 'reportedAreas', label: 'Most reported' },
  { key: 'resolvedAreas', label: 'Most resolved' },
  { key: 'rejectedAreas', label: 'Most rejected' }
];

export default function HotspotTable({ hotspots }) {
  const [view, setView] = useState('topZones');
  const rows = hotspots?.[view] || [];
  const isZoneView = view === 'topZones' || view === 'categoryHotspots';
  return <section className="panel hotspot-table-panel">
    <div className="panel-heading"><div><p className="eyebrow">Hotspot detection</p><h2>High activity areas</h2></div></div>
    <div className="hotspot-tabs" role="tablist">{views.map((item) => <button type="button" role="tab" aria-selected={view === item.key} className={view === item.key ? 'active' : ''} key={item.key} onClick={() => setView(item.key)}>{item.label}</button>)}</div>
    {rows.length ? <div className="table-wrap"><table><thead><tr><th>Rank</th><th>{view === 'categoryHotspots' ? 'Category' : isZoneView ? 'Zone' : 'Area'}</th>{isZoneView && <th>Coordinates</th>}<th>Complaints</th></tr></thead><tbody>{rows.slice(0, 10).map((row, index) => <tr key={`${row.zone || row.area || row.category}-${index}`}><td>{String(index + 1).padStart(2, '0')}</td><td>{row.area || row.zone || row.category?.replaceAll('_', ' ') || 'Unknown area'}</td>{isZoneView && <td>{row.latitude?.toFixed(3)}, {row.longitude?.toFixed(3)}</td>}<td><strong>{row.count}</strong></td></tr>)}</tbody></table></div> : <div className="empty-table">No hotspot data for this selection yet.</div>}
  </section>;
}
