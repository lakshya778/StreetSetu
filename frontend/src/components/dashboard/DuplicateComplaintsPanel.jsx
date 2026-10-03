import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../api/client.js';
import { getDuplicateComplaints, mergeDuplicateComplaint } from '../../api/complaints.js';
import { statusLabel } from '../complaints/ComplaintCard.jsx';

export default function DuplicateComplaintsPanel({ topCategories = [] }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [masterIds, setMasterIds] = useState({});

  async function load() {
    try { setItems(await getDuplicateComplaints()); setError(''); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Duplicate complaints could not be loaded.')); }
  }

  useEffect(() => { load(); }, []);

  async function merge(item) {
    const masterId = masterIds[item._id] || item.duplicateOf?._id || item.masterComplaint?._id;
    if (!masterId) { setError('Enter the canonical complaint ID to merge this report.'); return; }
    setActiveId(item._id);
    setError('');
    try { await mergeDuplicateComplaint(item._id, masterId); await load(); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'The duplicate could not be merged.')); }
    finally { setActiveId(''); }
  }

  return <section className="panel duplicate-admin-panel">
    <div className="panel-heading"><div><p className="eyebrow">AI duplicate review</p><h2>Duplicate complaints</h2></div><span className="rejection-badge">{items.length} flagged</span></div>
    {error && <div className="notice-banner">{error}</div>}
    {topCategories.length > 0 && <div className="duplicate-category-summary">{topCategories.map((item) => <span key={item.category}>{item.category.replaceAll('_', ' ')} <strong>{item.count}</strong></span>)}</div>}
    {items.length ? <div className="duplicate-admin-list">{items.map((item) => {
      const master = item.duplicateOf || item.masterComplaint;
      return <article className="duplicate-admin-row" key={item._id}>
        <div className="duplicate-admin-copy"><strong>{item.title}</strong><span>{item.category?.replaceAll('_', ' ')} · {statusLabel(item.status)} · {item.supporterCount || 0} supporters · score {item.duplicateScore || 0}%</span><small>{master ? `Linked to: ${master.title || master._id}` : 'No canonical complaint linked yet'}</small></div>
        <div className="duplicate-admin-action"><input value={masterIds[item._id] ?? master?._id ?? ''} onChange={(event) => setMasterIds((current) => ({ ...current, [item._id]: event.target.value }))} placeholder="Canonical complaint ID" aria-label={`Canonical complaint ID for ${item.title}`} /><button type="button" disabled={activeId === item._id || Boolean(item.mergedAt)} onClick={() => merge(item)}>{item.mergedAt ? 'Merged' : activeId === item._id ? 'Merging…' : 'Merge'}</button></div>
      </article>;
    })}</div> : <div className="empty-state compact-empty"><strong>No duplicates to review</strong><p>Scored duplicate reports will appear here.</p></div>}
  </section>;
}
