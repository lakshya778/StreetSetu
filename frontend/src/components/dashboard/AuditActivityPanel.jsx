import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../api/client.js';
import { useNotifications } from '../../context/NotificationContext.jsx';

export default function AuditActivityPanel() {
  const { socket } = useNotifications();
  const [result, setResult] = useState({ items: [], page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => api.get('/dashboard/activity', { params: { page, limit: 8, search: search || undefined } })
      .then(({ data }) => { if (mounted) { setResult(data.data); setError(''); } })
      .catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'Activity history is unavailable.')); }), 180);
    return () => { mounted = false; clearTimeout(timer); };
  }, [page, search]);

  useEffect(() => {
    if (!socket) return undefined;
    const reload = () => api.get('/dashboard/activity', { params: { page, limit: 8, search: search || undefined } }).then(({ data }) => setResult(data.data)).catch(() => {});
    socket.on('dashboard:updated', reload);
    return () => socket.off('dashboard:updated', reload);
  }, [socket, page, search]);

  return <section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Governance trail</p><h2>Admin activity</h2></div><input className="activity-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search activity" aria-label="Search admin activity" /></div>
    {error && <div className="notice-banner">{error}</div>}
    {result.items?.length ? <><div className="admin-activity-list">{result.items.map((entry) => <article key={entry._id}><div><strong>{entry.action.replaceAll('.', ' ')}</strong><small>{entry.actor?.name || 'System'} · {new Date(entry.createdAt).toLocaleString('en-IN')}</small></div><span>{entry.entityType}{entry.previousValue ? ` · ${entry.previousValue} → ${entry.newValue}` : ''}</span></article>)}</div>{result.pages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {result.pages}</span><button disabled={page >= result.pages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}</> : <div className="empty-table">No admin activity recorded yet.</div>}
  </section>;
}
