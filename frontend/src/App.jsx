import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import DashboardHomePage from './pages/DashboardHomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import ComplaintListPage from './pages/ComplaintListPage.jsx';
import CreateComplaintPage from './pages/CreateComplaintPage.jsx';
import ComplaintDetailsPage from './pages/ComplaintDetailsPage.jsx';
import NotificationPage from './pages/NotificationPage.jsx';
import ComplaintManagementHomePage from './pages/ComplaintManagementHomePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardHomePage />} />
          <Route path="/dashboard/complaints" element={<ComplaintManagementHomePage />} />
          <Route path="/dashboard/my-complaints" element={<ComplaintListPage mine />} />
          <Route path="/dashboard/complaints/new" element={<CreateComplaintPage />} />
          <Route path="/dashboard/complaints/:id" element={<ComplaintDetailsPage />} />
          <Route path="/dashboard/neighbourhoods" element={<WorkspacePage />} />
          <Route path="/dashboard/notifications" element={<NotificationPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
