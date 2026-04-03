import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import EmployeeDashboard from './pages/EmployeeDashboard.jsx';
import BlogCreatePage from './pages/BlogCreatePage.jsx';
import MyBlogsPage from './pages/MyBlogsPage.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminEmployeesPage from './pages/AdminEmployeesPage.jsx';
import PublicBlogPage from './pages/PublicBlogPage.jsx';
import PublicBlogDetailPage from './pages/PublicBlogDetailPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard/employee"
          element={
            <ProtectedRoute roles={['EMPLOYEE']}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/employee/create/:categorySlug"
          element={
            <ProtectedRoute roles={['EMPLOYEE']}>
              <BlogCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/employee/my-blogs"
          element={
            <ProtectedRoute roles={['EMPLOYEE']}>
              <MyBlogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin/employees"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminEmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/site/:websiteId" element={<PublicBlogPage />} />
        <Route path="/site/:websiteId/post/:blogId" element={<PublicBlogDetailPage />} />
        <Route path="*" element={<div className="shell">Page not found</div>} />
      </Route>
    </Routes>
  );
}
