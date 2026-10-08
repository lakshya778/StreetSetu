import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client.js';
import { getNotifications } from '../api/notifications.js';
import { useNotifications } from '../context/NotificationContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import SkeletonList from '../components/layout/SkeletonList.jsx';
import PageHeader from '../components/layout/PageHeader.jsx';
import StreetEmptyIllustration from '../components/layout/StreetEmptyIllustration.jsx';

function notificationDate(value) {
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function notificationIcon(notification) {
  const eventType = notification.metadata?.eventType || notification.type;
  const paths = {
    assigned: <><path d="M5 12h14M12 5l7 7-7 7" /></>,
    status_changed: <><path d="M7 7h10v10" /><path d="m7 17 10-10M5 5v4m14 6v4" /></>,
    resolved: <><path d="m5 12 4 4L19 6" /></>,
    rejected: <><path d="m7 7 10 10M17 7 7 17" /></>,
    image_uploaded: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[eventType] || <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>}</svg>;
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
  const notificationGroup = (value) => {
    const date = new Date(value);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate() ? 'Today' : 'Earlier';
  };
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
  return <div className="notifications-page">
    <PageHeader kicker="Your inbox" title="Notifications" subtitle="Status updates and actions that need your attention." actions={<span className="notification-count-label">{unreadCount} unread</span>} />
    <div className="complaint-toolbar"><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search notifications" aria-label="Search notifications" /><select value={eventType} onChange={(event) => { setEventType(event.target.value); setPage(1); }}><option value="">All activity</option><option value="assigned">Assignments</option><option value="status_changed">Status changes</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option><option value="image_uploaded">Image uploads</option><option value="recommendation_accepted">Recommendations</option></select></div>
    {displayError && <div className="notice-banner">{displayError}<button onClick={() => { setError(''); refreshNotifications(); }}>Retry</button></div>}
    {loading ? <SkeletonList rows={4} variant="row" /> : result.items.length ? <section className="notification-page-list">{result.items.map((notification, index) => {
      const group = notificationGroup(notification.createdAt);
      const previousGroup = index ? notificationGroup(result.items[index - 1].createdAt) : '';
      return <div key={notification._id}>
        {group !== previousGroup && <h2 className="notification-group-heading">{group}</h2>}
        <article className={`notification-page-item ${notification.status !== 'read' ? 'is-unread' : ''}`}><span className="notification-page-icon">{notificationIcon(notification)}</span><div className="notification-page-copy"><div><h2>{notification.title}</h2><time>{notificationDate(notification.createdAt)}</time></div><p>{notification.message}</p>{notification.complaint && <small>Complaint: {notification.complaint.title}</small>}</div>{notification.status !== 'read' && <button className="outline-button mark-read-button" onClick={() => handleMarkRead(notification._id)}>Mark as read</button>}</article>
      </div>;
    })}</section> : <div className="empty-state notification-empty"><StreetEmptyIllustration /><strong>All caught up</strong><p>There are no notifications to show.</p><Link className="outline-button" to="/dashboard/complaints">Browse complaints</Link></div>}
    {result.pages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>← Previous</button><span>Page {page} of {result.pages}</span><button disabled={page >= result.pages} onClick={() => setPage((current) => current + 1)}>Next →</button></div>}
  </div>;
}
