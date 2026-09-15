import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../api/client.js';
import { getNotifications } from '../api/notifications.js';
import { useNotifications } from '../context/NotificationContext.jsx';

function notificationDate(value) {
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function NotificationPage() {
  const { notifications, notificationMeta, unreadCount, isLoading: contextLoading, error: contextError, markRead, refreshNotifications } = useNotifications();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: notifications, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setResult((current) => ({ ...current, items: page === 1 ? notifications : current.items, total: notificationMeta.total, pages: notificationMeta.pages }));
  }, [notifications, notificationMeta, page]);

  useEffect(() => {
    if (page === 1) return;
    let mounted = true;
    setIsLoading(true);
    getNotifications({ page, limit: 20 }).then((data) => { if (mounted) setResult(data); }).catch((requestError) => { if (mounted) setError(getApiErrorMessage(requestError, 'Notifications could not be loaded.')); }).finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [page]);

  const loading = contextLoading || isLoading;
  const displayError = error || contextError;
  return <div className="notifications-page"><div className="page-heading"><div><p className="eyebrow">Your inbox</p><h1>Notifications</h1><p className="page-lede">Status updates and actions that need your attention.</p></div><span className="notification-count-label">{unreadCount} unread</span></div>{displayError && <div className="notice-banner">{displayError}<button onClick={() => { setError(''); refreshNotifications(); }}>Retry</button></div>}{loading ? <div className="loading-state">Loading notifications...</div> : result.items.length ? <section className="notification-page-list">{result.items.map((notification) => <article className={`notification-page-item ${notification.status !== 'read' ? 'is-unread' : ''}`} key={notification._id}><span className="notification-page-icon">{notification.status === 'read' ? '✓' : '•'}</span><div className="notification-page-copy"><div><h2>{notification.title}</h2><time>{notificationDate(notification.createdAt)}</time></div><p>{notification.message}</p>{notification.complaint && <small>Complaint: {notification.complaint.title}</small>}</div>{notification.status !== 'read' && <button className="outline-button mark-read-button" onClick={() => markRead(notification._id)}>Mark as read</button>}</article>)}</section> : <div className="empty-state notification-empty"><span>✓</span><strong>All caught up</strong><p>There are no notifications to show.</p></div>}{result.pages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>← Previous</button><span>Page {page} of {result.pages}</span><button disabled={page >= result.pages} onClick={() => setPage((current) => current + 1)}>Next →</button></div>}</div>;
}
