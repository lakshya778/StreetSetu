import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { NotificationProvider, useNotifications } from '../../context/NotificationContext.jsx';
import NotificationDropdown from '../notifications/NotificationDropdown.jsx';
import InstallAppPrompt from './InstallAppPrompt.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

const baseNavigation = [
  { labelKey: 'nav.overview', path: '/dashboard', icon: 'overview' },
  { labelKey: 'nav.complaints', path: '/dashboard/complaints', icon: 'complaints' },
  { labelKey: 'nav.myComplaints', path: '/dashboard/my-complaints', icon: 'mine' },
  { labelKey: 'nav.neighbourhoods', path: '/dashboard/neighbourhoods', icon: 'neighbourhoods' },
  { labelKey: 'nav.notifications', path: '/dashboard/notifications', icon: 'notifications' },
  { labelKey: 'nav.drives', path: '/dashboard/drives', icon: 'drives' },
  { labelKey: 'nav.leaderboard', path: '/dashboard/leaderboard', icon: 'leaderboard' },
  { labelKey: 'nav.myImpact', path: '/dashboard/impact', icon: 'impact' },
  { labelKey: 'nav.guide', path: '/dashboard/segregation-guide', icon: 'guide' }
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
    leaderboard: <><path d="M8 21h8m-4-4v4M7 4h10v7a5 5 0 0 1-10 0Z" /><path d="M7 7H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4" /></>,
    impact: <><path d="M12 3v18m9-9H3" /><circle cx="12" cy="12" r="9" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.overview}</svg>;
}

function DashboardFrame() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const navigation = user?.role === 'volunteer'
    ? [{ labelKey: 'nav.overview', path: '/dashboard', icon: 'overview' }, ...baseNavigation.filter((item) => item.path !== '/dashboard' && item.path !== '/dashboard/my-complaints')]
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
            <span>{t('nav.civicOperations', 'civic operations')}</span>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label={t('nav.closeNavigation')}>×</button>
        </div>
        <div className="sidebar-section-label">{t('nav.workspace')}</div>
        <nav className="sidebar-nav" aria-label={t('nav.quickNavigation')}>
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon"><NavigationIcon name={item.icon} /></span>
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="help-panel">
            <span className="help-dot" />
            <div><strong>{t('nav.systemHealthy')}</strong><small>{t('nav.servicesResponding')}</small></div>
          </div>
          <button className="sidebar-link logout-link" onClick={handleLogout}><span className="nav-icon"><NavigationIcon name="logout" /></span>{t('nav.signOut')}</button>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label={t('nav.closeNavigation')} />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label={t('nav.openNavigation')}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
          <div className="topbar-brand"><div className="brand-mark">S</div><div className="breadcrumb"><strong>StreetSetu</strong><b>/</b><span>{t('nav.brandSubtitle')}</span></div></div>
          <div className="topbar-actions">
            <LanguageSwitcher />
            <InstallAppPrompt />
            <div className="notification-anchor"><button className="notification-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label={unreadCount ? t('nav.notificationsUnread', { count: unreadCount }) : t('nav.notificationsView')} aria-expanded={notificationsOpen}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>{unreadCount > 0 && <b className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</b>}</button>{notificationsOpen && <NotificationDropdown onClose={() => setNotificationsOpen(false)} />}</div>
            <div className="user-chip">
              <div className="avatar">{user?.name?.slice(0, 1).toUpperCase() || 'U'}</div>
              <div className="user-copy"><strong>{user?.name || 'User'}</strong><span>{user?.role === 'admin' ? t('nav.roleAdmin') : user?.role === 'volunteer' ? t('nav.roleVolunteer') : t('nav.roleCitizen')}</span></div>
            </div>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
        <nav className="mobile-bottom-nav" aria-label={t('nav.quickNavigation')}>
          {mobileNavigation.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/dashboard'} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
              <NavigationIcon name={item.icon} /><span>{t(item.labelKey)}</span>
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
