import { useAuth } from '../context/AuthContext.jsx';
import DashboardPage from './DashboardPage.jsx';
import VolunteerDashboardPage from './VolunteerDashboardPage.jsx';

export default function DashboardHomePage() {
  const { user } = useAuth();
  return user?.role === 'volunteer' ? <VolunteerDashboardPage /> : <DashboardPage />;
}
