import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { NotificationProvider, useNotifications } from '../../context/NotificationContext.jsx';
import NotificationDropdown from '../notifications/NotificationDropdown.jsx';
import InstallAppPrompt from './InstallAppPrompt.jsx';

const baseNavigation = [
  { label: 'Overview', path: '/dashboard', icon: 'overview' },
  { label: 'Complaints', path: '/dashboard/complaints', icon: 'complaints' },
  { label: 'My complaints', path: '/dashboard/my-complaints', icon: 'mine' },
  { label: 'Neighbourhoods', path: '/dashboard/neighbourhoods', icon: 'neighbourhoods' },
  { label: 'Notifications', path: '/dashboard/notifications', icon: 'notifications' },
  { label: 'Volunteer drives', path: '/dashboard/drives', icon: 'drives' },
  { label: 'Segregation guide', path: '/dashboard/segregation-guide', icon: 'guide' }
];

function NavigationIcon({ name }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    complaints: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    mine: <><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    neighbourhoods: <><path d="M3 21h18M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></>,
    notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    drives: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="m9 10 2 2 4-4" /></>,
    guide: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.overview}</svg>;
}

function DashboardFrame() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const navigation = user?.role === 'volunteer'
    ? [{ label: 'Volunteer dashboard', path: '/dashboard', icon: 'overview' }, ...baseNavigation.filter((item) => item.path !== '/dashboard' && item.path !== '/dashboard/my-complaints')]
    : baseNavigation;
  const mobileNavigation = navigation.filter((item) => ['/dashboard', '/dashboard/complaints', '/dashboard/my-complaints', '/dashboard/notifications'].includes(item.path)).slice(0, 4);

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
              <span className="nav-icon"><NavigationIcon name={item.icon} /></span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="help-panel">
            <span className="help-dot" />
            <div><strong>System healthy</strong><small>All services responding</small></div>
          </div>
          <button className="sidebar-link logout-link" onClick={handleLogout}><span className="nav-icon"><NavigationIcon name="logout" /></span>Sign out</button>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
          <div className="topbar-brand"><div className="brand-mark">S</div><div className="breadcrumb"><strong>StreetSetu</strong><b>/</b><span>Neighbourhood action</span></div></div>
          <div className="topbar-actions">
            <InstallAppPrompt />
            <div className="notification-anchor"><button className="notification-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label={`View notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={notificationsOpen}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>{unreadCount > 0 && <b className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</b>}</button>{notificationsOpen && <NotificationDropdown onClose={() => setNotificationsOpen(false)} />}</div>
            <div className="user-chip">
              <div className="avatar">{user?.name?.slice(0, 1).toUpperCase() || 'U'}</div>
              <div className="user-copy"><strong>{user?.name || 'User'}</strong><span>{user?.role || 'citizen'}</span></div>
            </div>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
        <nav className="mobile-bottom-nav" aria-label="Quick navigation">
          {mobileNavigation.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/dashboard'} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
              <NavigationIcon name={item.icon} /><span>{item.label === 'Volunteer dashboard' ? 'Overview' : item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  return <NotificationProvider><DashboardFrame /></NotificationProvider>;
}
