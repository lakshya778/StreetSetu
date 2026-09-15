import { useAuth } from '../context/AuthContext.jsx';
import AdminComplaintManagementPage from './AdminComplaintManagementPage.jsx';
import ComplaintListPage from './ComplaintListPage.jsx';

export default function ComplaintManagementHomePage() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminComplaintManagementPage /> : <ComplaintListPage />;
}
