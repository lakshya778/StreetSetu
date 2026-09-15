import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../api/client.js';
import { getNotifications, markNotificationRead as markNotificationReadRequest } from '../api/notifications.js';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [notificationMeta, setNotificationMeta] = useState({ total: 0, pages: 1 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function refreshNotifications() {
    setIsLoading(true);
    setError('');
    try {
      const [preview, unread] = await Promise.all([
        getNotifications({ page: 1, limit: 20 }),
        getNotifications({ page: 1, limit: 1, unread: true })
      ]);
      setNotifications(preview.items || []);
      setNotificationMeta({ total: preview.total || 0, pages: preview.pages || 1 });
      setUnreadCount(unread.total || 0);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Notifications could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function markRead(id) {
    const current = notifications.find((notification) => notification._id === id);
    if (!current || current.status === 'read') return;
    try {
      await markNotificationReadRequest(id);
      setNotifications((items) => items.map((notification) => notification._id === id ? { ...notification, status: 'read', readAt: new Date().toISOString() } : notification));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Notification could not be marked as read.'));
      throw requestError;
    }
  }

  useEffect(() => { refreshNotifications(); }, []);

  const value = useMemo(() => ({ notifications, notificationMeta, unreadCount, isLoading, error, refreshNotifications, markRead }), [notifications, notificationMeta, unreadCount, isLoading, error]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}
