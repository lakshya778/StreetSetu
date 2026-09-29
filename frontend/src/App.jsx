import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

const DashboardHomePage = lazy(() => import('./pages/DashboardHomePage.jsx'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage.jsx'));
const ComplaintListPage = lazy(() => import('./pages/ComplaintListPage.jsx'));
const CreateComplaintPage = lazy(() => import('./pages/CreateComplaintPage.jsx'));
const ComplaintDetailsPage = lazy(() => import('./pages/ComplaintDetailsPage.jsx'));
const NotificationPage = lazy(() => import('./pages/NotificationPage.jsx'));
const ComplaintManagementHomePage = lazy(() => import('./pages/ComplaintManagementHomePage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<div className="loading-state">Loading StreetSetu...</div>}><Routes>
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
    </Routes></Suspense>
  );
}
