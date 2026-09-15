import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext.jsx';

function notificationDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationDropdown({ onClose }) {
  const { notifications, isLoading, error, markRead, refreshNotifications } = useNotifications();
  const unread = notifications.filter((notification) => notification.status !== 'read');

  async function handleRead(notification) {
    if (notification.status !== 'read') await markRead(notification._id);
  }

  return <div className="notification-popover"><div className="notification-popover-heading"><div><p className="eyebrow">Your inbox</p><h2>Notifications</h2></div><button className="icon-button" onClick={refreshNotifications} aria-label="Refresh notifications">↻</button></div>{isLoading ? <div className="notification-state">Loading notifications...</div> : error ? <div className="notification-state notification-error">{error}<button onClick={refreshNotifications}>Retry</button></div> : unread.length ? <div className="notification-items">{unread.slice(0, 4).map((notification) => <button className="notification-item unread" key={notification._id} onClick={() => handleRead(notification)}><span className="notification-item-dot" /><span><strong>{notification.title}</strong><small>{notification.message}</small><em>{notificationDate(notification.createdAt)}</em></span></button>)}</div> : <div className="notification-state"><span>✓</span><strong>All caught up</strong><small>No unread notifications</small></div>}<Link className="notification-view-all" to="/dashboard/notifications" onClick={onClose}>View all notifications <span>→</span></Link></div>;
}
