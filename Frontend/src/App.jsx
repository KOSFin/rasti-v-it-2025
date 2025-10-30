import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Goals from './components/Goals';
import Tasks from './components/Tasks';
import SelfAssessment from './components/SelfAssessment';
import Feedback360 from './components/Feedback360';
import NineBox from './components/NineBox';
import './App.css';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('access_token');
  return token ? children : <Navigate to="/login" />;
}

function App() {
  return (
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
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
