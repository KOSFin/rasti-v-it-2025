import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  getGoalNotifications,
  markGoalNotificationRead,
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
  const notificationsRef = useRef([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setGoalEvaluationCount(0);
      return;
    }

    setLoading(true);

    try {
      const [notifResponse, goalResponse] = await Promise.all([
        getNotifications({ limit: 20 }),
        getGoalNotifications({ is_completed: false }),
      ]);

      const systemPayload = notifResponse?.data ?? {};
      const systemResults = Array.isArray(systemPayload?.results)
        ? systemPayload.results
        : Array.isArray(systemPayload)
          ? systemPayload
          : [];
      const systemUnread = systemPayload?.unread_count ?? 0;

      const goalPayload = goalResponse?.data ?? {};
      const goalResults = Array.isArray(goalPayload?.results)
        ? goalPayload.results
        : Array.isArray(goalPayload)
          ? goalPayload
          : [];

      const normalizedSystem = systemResults.map((item) => ({
        ...item,
        id: `system-${item.id}`,
        backendId: item.id,
        type: 'system',
        created_at: item.created_at,
      }));

      const normalizedGoal = goalResults.map((item) => {
        const link = item.link || `/feedback-360?goal=${item.goal}`;
        const linkWithId = link.includes('notification_id=')
          ? link
          : `${link}${link.includes('?') ? '&' : '?'}notification_id=goal-${item.id}`;

        return {
          ...item,
          id: `goal-${item.id}`,
          backendId: item.id,
          type: 'goal',
          created_at: item.created_at,
          link: linkWithId,
        };
      });

      const goalUnread = normalizedGoal.reduce(
        (total, item) => (!item.is_read && !item.is_completed ? total + 1 : total),
        0,
      );

      setNotifications([...normalizedSystem, ...normalizedGoal]);
      setUnreadCount(systemUnread);
      setGoalEvaluationCount(goalUnread);
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
    async (target) => {
      const targetId = typeof target === 'object' && target ? target.id : String(target);
      const existing =
        typeof target === 'object' && target
          ? target
          : notificationsRef.current.find(
              (item) => item.id === targetId || String(item.backendId) === String(target),
            );

      if (!existing) {
        return;
      }

      const now = new Date().toISOString();
      const wasUnread = !existing.is_read && (existing.type === 'system' || !existing.is_completed);

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === existing.id
            ? { ...item, is_read: true, read_at: item.read_at || now }
            : item,
        ),
      );

      if (existing.type === 'system' && wasUnread) {
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }

      if (existing.type === 'goal' && wasUnread) {
        setGoalEvaluationCount((prev) => Math.max(prev - 1, 0));
      }

      const request = existing.type === 'goal'
        ? markGoalNotificationRead(existing.backendId)
        : markNotificationRead(existing.backendId);

      try {
        await request;
      } catch (readError) {
        console.error('Не удалось отметить уведомление прочитанным', readError);
        fetchNotifications();
      }
    },
    [fetchNotifications],
  );

  const markAllAsRead = useCallback(async () => {
    if (!notifications.length) {
      return;
    }

    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true, read_at: item.read_at || now })));
    setUnreadCount(0);
    setGoalEvaluationCount(0);

    const goalUnread = notificationsRef.current.filter(
      (item) => item.type === 'goal' && !item.is_read && !item.is_completed,
    );

    try {
      await Promise.all([
        markAllNotificationsRead(),
        ...goalUnread.map((item) => markGoalNotificationRead(item.backendId)),
      ]);
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
