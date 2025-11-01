import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  getGoalNotificationsUnreadCount,
} from '../api/services';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [goalEvaluationCount, setGoalEvaluationCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollerRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setGoalEvaluationCount(0);
      return;
    }

    setLoading(true);

    try {
      const [notifResponse, goalCountResponse] = await Promise.all([
        getNotifications({ limit: 20 }),
        getGoalNotificationsUnreadCount(),
      ]);
      
      const { results = [], unread_count: unread = 0 } = notifResponse.data || {};
      const goalData = goalCountResponse.data || {};
      const goalCount =
        typeof goalData.unread_count === 'number'
          ? goalData.unread_count
          : typeof goalData.count === 'number'
            ? goalData.count
            : 0;
      
      setNotifications(results);
      setUnreadCount(unread);
      setGoalEvaluationCount(goalCount);
      setError(null);
    } catch (fetchError) {
      console.error('Не удалось загрузить уведомления', fetchError);
      setError(fetchError);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || authLoading) {
      setNotifications([]);
      setUnreadCount(0);
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
      return;
    }

    fetchNotifications();
    pollerRef.current = setInterval(fetchNotifications, 60_000);

    return () => {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
    };
  }, [user, authLoading, fetchNotifications]);

  const markAsRead = useCallback(
    async (notificationId) => {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? { ...item, is_read: true, read_at: new Date().toISOString() }
            : item
        )
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));

      try {
        await markNotificationRead(notificationId);
      } catch (readError) {
        console.error('Не удалось отметить уведомление прочитанным', readError);
        fetchNotifications();
      }
    },
    [fetchNotifications]
  );

  const markAllAsRead = useCallback(async () => {
    if (!notifications.length) {
      return;
    }

    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true, read_at: new Date().toISOString() })));
    setUnreadCount(0);

    try {
      await markAllNotificationsRead();
    } catch (readError) {
      console.error('Не удалось отметить все уведомления', readError);
      fetchNotifications();
    }
  }, [notifications.length, fetchNotifications]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      goalEvaluationCount,
      totalUnread: unreadCount + goalEvaluationCount,
      loading,
      error,
      refresh: fetchNotifications,
      markAsRead,
      markAllAsRead,
    }),
    [notifications, unreadCount, goalEvaluationCount, loading, error, fetchNotifications, markAsRead, markAllAsRead]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};
