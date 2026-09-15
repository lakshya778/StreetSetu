import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { NotificationProvider, useNotifications } from '../../context/NotificationContext.jsx';
import NotificationDropdown from '../notifications/NotificationDropdown.jsx';

const baseNavigation = [
  { label: 'Overview', path: '/dashboard', icon: '◈' },
  { label: 'Complaints', path: '/dashboard/complaints', icon: '▤' },
  { label: 'My complaints', path: '/dashboard/my-complaints', icon: '◎' },
  { label: 'Neighbourhoods', path: '/dashboard/neighbourhoods', icon: '⌖' },
  { label: 'Notifications', path: '/dashboard/notifications', icon: '◌' }
];

function DashboardFrame() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const navigation = user?.role === 'volunteer'
    ? [{ label: 'Volunteer dashboard', path: '/dashboard', icon: '◈' }, ...baseNavigation.filter((item) => item.path !== '/dashboard' && item.path !== '/dashboard/my-complaints')]
    : baseNavigation;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>StreetSetu</strong>
            <span>civic operations</span>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">×</button>
        </div>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="help-panel">
            <span className="help-dot" />
            <div><strong>System healthy</strong><small>All services responding</small></div>
          </div>
          <button className="sidebar-link logout-link" onClick={handleLogout}><span className="nav-icon">↪</span>Sign out</button>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">☰</button>
          <div className="breadcrumb"><span>StreetSetu</span><b>/</b><strong>Operations</strong></div>
          <div className="topbar-actions">
            <div className="notification-anchor"><button className="notification-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label={`View notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={notificationsOpen}><span>◌</span>{unreadCount > 0 && <b className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</b>}</button>{notificationsOpen && <NotificationDropdown onClose={() => setNotificationsOpen(false)} />}</div>
            <div className="user-chip">
              <div className="avatar">{user?.name?.slice(0, 1).toUpperCase() || 'U'}</div>
              <div className="user-copy"><strong>{user?.name || 'User'}</strong><span>{user?.role || 'citizen'}</span></div>
            </div>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  return <NotificationProvider><DashboardFrame /></NotificationProvider>;
}
