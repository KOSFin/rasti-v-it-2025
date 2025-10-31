import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Layout from './components/layout/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Goals from './components/Goals';
import Tasks from './components/Tasks';
import SelfAssessment from './components/SelfAssessment';
import Feedback360 from './components/Feedback360';
import NineBox from './components/NineBox';
import Team from './components/Team';
import Reports from './components/Reports';
import AdminUsers from './components/AdminUsers';
import AdminDepartments from './components/AdminDepartments';
import SkillReview from './components/reviews/SkillReview';
import TaskReview from './components/reviews/TaskReview';
import './App.css';

function PrivateRoute({ children, requireAdmin = false, requireManager = false }) {
  const { user, employee, loading, pendingReview } = useAuth();
  const location = useLocation();
  const token = localStorage.getItem('access_token');

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" aria-hidden="true" />
        <span>Загрузка рабочего пространства…</span>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !user.is_superuser) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireManager && !(employee?.is_manager || user?.is_superuser)) {
    return <Navigate to="/dashboard" replace />;
  }

  const requiresInitialReview =
    pendingReview &&
    pendingReview.context === 'skill' &&
    pendingReview.token;

  if (requiresInitialReview) {
    const targetPath = `/reviews/skills/${pendingReview.token}`;
    if (location.pathname !== targetPath) {
      const params = new URLSearchParams(location.search);
      if (!params.has('welcome')) {
        params.set('welcome', '1');
      }
      return <Navigate to={`${targetPath}?${params.toString()}`} replace />;
    }
  }

  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/goals"
              element={
                <PrivateRoute>
                  <Goals />
                </PrivateRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <PrivateRoute>
                  <Tasks />
                </PrivateRoute>
              }
            />
            <Route
              path="/self-assessment"
              element={
                <PrivateRoute>
                  <SelfAssessment />
                </PrivateRoute>
              }
            />
            <Route
              path="/feedback-360"
              element={
                <PrivateRoute>
                  <Feedback360 />
                </PrivateRoute>
              }
            />
            <Route
              path="/reviews/skills/:token"
              element={
                <PrivateRoute>
                  <SkillReview />
                </PrivateRoute>
              }
            />
            <Route
              path="/reviews/tasks/:token"
              element={
                <PrivateRoute>
                  <TaskReview />
                </PrivateRoute>
              }
            />
            <Route
              path="/nine-box"
              element={
                <PrivateRoute>
                  <NineBox />
                </PrivateRoute>
              }
            />
            <Route
              path="/team"
              element={
                <PrivateRoute requireManager>
                  <Team />
                </PrivateRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <PrivateRoute requireManager>
                  <Reports />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <PrivateRoute requireAdmin>
                  <AdminUsers />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/departments"
              element={
                <PrivateRoute requireAdmin>
                  <AdminDepartments />
                </PrivateRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
