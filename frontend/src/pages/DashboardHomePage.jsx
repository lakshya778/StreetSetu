import { lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const DashboardPage = lazy(() => import('./DashboardPage.jsx'));
const VolunteerDashboardPage = lazy(() => import('./VolunteerDashboardPage.jsx'));

export default function DashboardHomePage() {
  const { user } = useAuth();
  const Dashboard = user?.role === 'volunteer' ? VolunteerDashboardPage : DashboardPage;
  return <Suspense fallback={<div className="page-skeleton" role="status" aria-label="Loading dashboard"><span /><span /><span /></div>}><Dashboard /></Suspense>;
}
