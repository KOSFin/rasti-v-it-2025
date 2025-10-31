import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Goals from './components/Goals';
import Tasks from './components/Tasks';
import SelfAssessment from './components/SelfAssessment';
import Feedback360 from './components/Feedback360';
import NineBox from './components/NineBox';
import AdminUsers from './components/AdminUsers';
import './App.css';

function PrivateRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();
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

  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
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
              path="/nine-box"
              element={
                <PrivateRoute>
                  <NineBox />
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
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
