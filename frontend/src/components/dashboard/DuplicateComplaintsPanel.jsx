import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

  const groups = useMemo(() => {
    const grouped = new Map();
    items.forEach((item) => {
      const master = item.duplicateOf || item.masterComplaint;
      const groupId = String(master?._id || master || item._id);
      if (!grouped.has(groupId)) grouped.set(groupId, { id: groupId, master, items: [] });
      const group = grouped.get(groupId);
      group.items.push(item);
      if (!group.master && master) group.master = master;
    });
    return [...grouped.values()];
  }, [items]);

  async function merge(item) {
    const masterId = masterIds[item._id] || item.duplicateOf?._id || item.masterComplaint?._id
      || (typeof item.duplicateOf === 'string' ? item.duplicateOf : '')
      || (typeof item.masterComplaint === 'string' ? item.masterComplaint : '');
    if (!masterId) { setError('Choose a canonical complaint after reviewing this duplicate group.'); return; }
    setActiveId(item._id);
    setError('');
    try { await mergeDuplicateComplaint(item._id, masterId); await load(); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'The duplicate could not be merged.')); }
    finally { setActiveId(''); }
  }

  return <section className="panel duplicate-admin-panel">
    <div className="panel-heading"><div><p className="eyebrow">AI duplicate review</p><h2>Duplicate groups</h2></div><span className="rejection-badge">{items.length} flagged</span></div>
    {error && <div className="notice-banner" role="alert">{error}</div>}
    {topCategories.length > 0 && <div className="duplicate-category-summary">{topCategories.map((item) => <span key={item.category}>{item.category.replaceAll('_', ' ')} <strong>{item.count}</strong></span>)}</div>}
    {groups.length ? <div className="duplicate-admin-list">{groups.map((group) => <section className="duplicate-admin-group" key={group.id}>
      <div className="duplicate-group-heading"><div><strong>{group.master?.title || `Duplicate group ${group.id.slice(-6)}`}</strong><span>{group.items.length} flagged report{group.items.length === 1 ? '' : 's'} · {group.master ? 'canonical complaint' : 'unlinked reports'}</span></div><Link to={`/dashboard/complaints/${group.master?._id || group.items[0]._id}`}>Review group</Link></div>
      {group.items.map((item) => {
        const master = item.duplicateOf || item.masterComplaint || group.master;
        const recommendedId = master?._id || (typeof master === 'string' ? master : '');
        return <article className="duplicate-admin-row" key={item._id}>
          <div className="duplicate-admin-copy"><Link to={`/dashboard/complaints/${item._id}`}>{item.title}</Link><span>{item.category?.replaceAll('_', ' ')} · {statusLabel(item.status)} · {item.supporterCount || 0} supporters · match score {item.duplicateScore || 0}%</span><small>{master ? `Recommended merge target: ${master.title || `complaint ${recommendedId}`} · confidence ${item.duplicateScore || 0}%` : 'No canonical target is linked. Review this report and its nearby matches before merging.'}</small></div>
          <div className="duplicate-admin-action"><input value={masterIds[item._id] ?? recommendedId} onChange={(event) => setMasterIds((current) => ({ ...current, [item._id]: event.target.value }))} placeholder="Canonical complaint ID" aria-label={`Canonical complaint ID for ${item.title}`} /><button type="button" disabled={activeId === item._id || Boolean(item.mergedAt) || !masterIds[item._id] && !recommendedId} onClick={() => merge(item)}>{item.mergedAt ? 'Merged' : activeId === item._id ? 'Merging…' : 'Merge'}</button></div>
        </article>;
      })}
    </section>)}</div> : <div className="empty-state compact-empty"><strong>No duplicates to review</strong><p>Scored duplicate reports will appear here.</p></div>}
  </section>;
}
