import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
import { getCurrentUser } from '../api/services';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [state, setState] = useState(() => {
    const storedUser = localStorage.getItem('user');
    const storedEmployee = localStorage.getItem('employee');

    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const parsedEmployee = storedEmployee ? JSON.parse(storedEmployee) : null;

    return {
      user: parsedUser,
      employee: parsedEmployee,
      pendingReview: parsedEmployee?.pending_self_review || null,
      loading: true,
      error: null,
    };
  });

  const clearAuthStorage = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('employee');
    localStorage.removeItem('refresh_token');
  }, []);

  const refreshProfile = useCallback(async () => {
    let token = localStorage.getItem('access_token');

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      if (!token) {
        const refreshResponse = await axios.post(
          `${API_URL}/api/auth/token/refresh/`,
          {},
          { withCredentials: true }
        );
        token = refreshResponse.data?.access || null;
        if (token) {
          localStorage.setItem('access_token', token);
        }
      }

      if (!token) {
        clearAuthStorage();
        setState({ user: null, employee: null, pendingReview: null, loading: false, error: null });
        return;
      }

      const response = await getCurrentUser();
      const { user, employee } = response.data;
      const pendingReview = employee?.pending_self_review || null;

      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('employee', JSON.stringify(employee));

      setState({ user, employee, pendingReview, loading: false, error: null });
    } catch (error) {
      console.error('Failed to fetch current user', error);
      clearAuthStorage();
      setState({ user: null, employee: null, pendingReview: null, loading: false, error });
    }
  }, [clearAuthStorage]);

  const signOut = useCallback(() => {
    clearAuthStorage();
    setState({ user: null, employee: null, pendingReview: null, loading: false, error: null });
  }, [clearAuthStorage]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return (
    <AuthContext.Provider value={{ ...state, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
