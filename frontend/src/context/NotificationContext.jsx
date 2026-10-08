import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { getApiErrorMessage } from '../api/client.js';
import { getNotifications, markNotificationRead as markNotificationReadRequest } from '../api/notifications.js';
import { useAuth } from './AuthContext.jsx';
import { getAccessToken } from '../auth/accessTokenStore.js';

const REALTIME_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'http://localhost:5000';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
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
        getNotifications({ page: 1, limit: 12 }),
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
    if (current?.status === 'read') return;
    try {
      await markNotificationReadRequest(id);
      setNotifications((items) => items.map((notification) => notification._id === id ? { ...notification, status: 'read', readAt: new Date().toISOString() } : notification));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Notification could not be marked as read.'));
      throw requestError;
    }
  }

  useEffect(() => { if (user) refreshNotifications(); }, [user?._id]);

  useEffect(() => {
    if (!user) { setSocket(null); return undefined; }
    let connection = null;
    function connect(token) {
      if (!token || connection) return;
      connection = io(REALTIME_URL, { auth: { token }, withCredentials: true, reconnection: true });
      setSocket(connection);
      connection.on('notification:new', (notification) => {
        setNotifications((items) => [notification, ...items.filter((item) => item._id !== notification._id)].slice(0, 20));
        setNotificationMeta((current) => ({ ...current, total: current.total + 1 }));
        if (notification.status !== 'read') setUnreadCount((count) => count + 1);
      });
      const dispatchUpdate = (payload) => window.dispatchEvent(new CustomEvent('streetsetu:live-update', { detail: payload }));
      connection.on('dashboard:updated', dispatchUpdate);
      connection.on('complaint:assigned', dispatchUpdate);
      connection.on('complaint:reassigned', dispatchUpdate);
      connection.on('complaint:status', dispatchUpdate);
      connection.on('complaint:rejected', dispatchUpdate);
      connection.on('connect_error', (connectError) => {
        if (/authentication required|invalid or expired token|account is unavailable/i.test(connectError.message || '')) {
          connection?.disconnect();
          window.dispatchEvent(new Event('streetsetu:session-expired'));
        }
      });
    }
    const refreshSocketToken = (event) => {
      if (!connection) return connect(event.detail.accessToken);
      connection.auth = { token: event.detail.accessToken };
      connection.disconnect().connect();
    };
    connect(getAccessToken());
    window.addEventListener('streetsetu:token-refreshed', refreshSocketToken);
    return () => {
      window.removeEventListener('streetsetu:token-refreshed', refreshSocketToken);
      connection?.disconnect();
      setSocket(null);
    };
  }, [user?._id]);

  const value = useMemo(() => ({ notifications, notificationMeta, unreadCount, isLoading, error, refreshNotifications, markRead, socket }), [notifications, notificationMeta, unreadCount, isLoading, error, socket]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}
