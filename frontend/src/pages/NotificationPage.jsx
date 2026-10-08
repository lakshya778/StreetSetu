import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../api/client.js';
import { getNotifications } from '../api/notifications.js';
import { useNotifications } from '../context/NotificationContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import SkeletonList from '../components/layout/SkeletonList.jsx';

function notificationDate(value) {
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function NotificationPage() {
  const { notifications, notificationMeta, unreadCount, isLoading: contextLoading, error: contextError, markRead, refreshNotifications } = useNotifications();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [eventType, setEventType] = useState('');
  const [result, setResult] = useState({ items: notifications, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (debouncedSearch || eventType) return;
    setResult((current) => ({ ...current, items: page === 1 ? notifications : current.items, total: notificationMeta.total, pages: notificationMeta.pages }));
  }, [notifications, notificationMeta, page, debouncedSearch, eventType]);

  useEffect(() => {
    if (page === 1 && !debouncedSearch && !eventType) return;
    let mounted = true;
    setIsLoading(true);
    getNotifications({ page, limit: 12, search: debouncedSearch || undefined, eventType: eventType || undefined }).then((data) => { if (mounted) setResult(data); }).catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'Notifications could not be loaded.')); }).finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [page, debouncedSearch, eventType]);

  const loading = contextLoading || isLoading;
  const displayError = error || contextError;
  async function handleMarkRead(id) {
    const previous = result.items.find((item) => item._id === id);
    if (!previous || previous.status === 'read') return;
    setResult((current) => ({ ...current, items: current.items.map((item) => item._id === id ? { ...item, status: 'read', readAt: new Date().toISOString() } : item) }));
    try {
      await markRead(id);
    } catch (requestError) {
      setResult((current) => ({ ...current, items: current.items.map((item) => item._id === id ? previous : item) }));
      setError(getApiErrorMessage(requestError, 'Notification could not be marked as read.'));
    }
  }
  return <div className="notifications-page"><div className="page-heading"><div><p className="eyebrow">Your inbox</p><h1>Notifications</h1><p className="page-lede">Status updates and actions that need your attention.</p></div><span className="notification-count-label">{unreadCount} unread</span></div><div className="complaint-toolbar"><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search notifications" aria-label="Search notifications" /><select value={eventType} onChange={(event) => { setEventType(event.target.value); setPage(1); }}><option value="">All activity</option><option value="assigned">Assignments</option><option value="status_changed">Status changes</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option><option value="image_uploaded">Image uploads</option><option value="recommendation_accepted">Recommendations</option></select></div>{displayError && <div className="notice-banner">{displayError}<button onClick={() => { setError(''); refreshNotifications(); }}>Retry</button></div>}{loading ? <SkeletonList rows={4} variant="row" /> : result.items.length ? <section className="notification-page-list">{result.items.map((notification) => <article className={`notification-page-item ${notification.status !== 'read' ? 'is-unread' : ''}`} key={notification._id}><span className="notification-page-icon">{notification.status === 'read' ? '✓' : '•'}</span><div className="notification-page-copy"><div><h2>{notification.title}</h2><time>{notificationDate(notification.createdAt)}</time></div><p>{notification.message}</p>{notification.complaint && <small>Complaint: {notification.complaint.title}</small>}</div>{notification.status !== 'read' && <button className="outline-button mark-read-button" onClick={() => handleMarkRead(notification._id)}>Mark as read</button>}</article>)}</section> : <div className="empty-state notification-empty"><span>✓</span><strong>All caught up</strong><p>There are no notifications to show.</p></div>}{result.pages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>← Previous</button><span>Page {page} of {result.pages}</span><button disabled={page >= result.pages} onClick={() => setPage((current) => current + 1)}>Next →</button></div>}</div>;
}
