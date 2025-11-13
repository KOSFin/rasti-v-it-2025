import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { IconBell, IconCheckCircle } from './Icons';
import useIconFallback from '../../hooks/useIconFallback';
import './NotificationBell.css';

const NotificationBell = () => {
  const { notifications, totalUnread, loading, markAsRead, markAllAsRead, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const [buttonRef, showFallback] = useIconFallback(open, totalUnread);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (!wrapperRef.current || wrapperRef.current.contains(event.target)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    refresh();
  }, [open, refresh]);

  const hasNotifications = notifications.length > 0;

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [notifications]);

  const handleItemClick = async (notification) => {
    if (!notification) {
      return;
    }

    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    setOpen(false);

    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div className="notification-wrapper" ref={wrapperRef}>
      <button
        type="button"
        ref={buttonRef}
        className={`notification-button ${open ? 'active' : ''}${showFallback ? ' fallback' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Уведомления"
      >
        <span className="icon-visual" aria-hidden="true">
          <IconBell size={18} />
        </span>
        <span className="icon-emoji" aria-hidden="true">🔔</span>
        {totalUnread > 0 && <span className="notification-badge">{Math.min(totalUnread, 9)}{totalUnread > 9 ? '+' : ''}</span>}
      </button>

      {open && (
        <div className="notification-dropdown" role="menu">
          <header className="notification-header">
            <div>
              <h4>Уведомления</h4>
              <span>{loading ? 'Обновляем…' : `${totalUnread} непрочитанных`}</span>
            </div>
            {hasNotifications && totalUnread > 0 && (
              <button type="button" className="mark-all" onClick={markAllAsRead}>
                <IconCheckCircle size={14} />
                <span>Отметить все</span>
              </button>
            )}
          </header>

          <div className="notification-list">
            {!hasNotifications && (
              <p className="notification-empty">Пока нет уведомлений.</p>
            )}

            {sortedNotifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`notification-item ${notification.is_read ? '' : 'unread'}`}
                onClick={() => handleItemClick(notification)}
              >
                <div className="notification-meta">
                  <p className="notification-title">{notification.title}</p>
                  <p className="notification-message">{notification.message}</p>
                </div>
                <time className="notification-time">
                  {new Date(notification.created_at).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
