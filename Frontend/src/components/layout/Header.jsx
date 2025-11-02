import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLogOut, FiMoon, FiSun } from 'react-icons/fi';
import { logout } from '../../api/services';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import './Header.css';

const Header = () => {
  const [showProfile, setShowProfile] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, employee, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');

    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } catch (error) {
      console.error('Не удалось корректно завершить сессию', error);
    } finally {
      signOut();
      navigate('/login');
    }
  };

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <header className="header">
      <div className="header-content">
        <div className="brand-block">
          <div className="brand-mark">RV</div>
          <div className="brand-meta">
            <span className="brand-name">РАСТИ В ИТ</span>
            <span className="brand-tag">Платформа оценки и развития</span>
          </div>
        </div>

        <div className="header-actions">
          <NotificationBell />
          <button
            onClick={toggleTheme}
            className="icon-btn"
            title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
          >
            {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>

          <div className="profile-menu-wrapper">
            <button
              onClick={() => setShowProfile((prev) => !prev)}
              className="profile-chip"
              aria-haspopup="true"
              aria-expanded={showProfile}
            >
              <div className="profile-avatar">
                {initials || <FiUser size={18} />}
              </div>
              <div className="profile-context">
                <span className="profile-name">
                  {user?.first_name} {user?.last_name}
                </span>
                <span className="profile-role">{employee?.position_title || employee?.position_name || 'Сотрудник'}</span>
              </div>
            </button>

            {showProfile && (
              <div className="profile-dropdown" role="menu">
                <div className="profile-section">
                  <p className="profile-section-title">Аккаунт</p>
                  <p className="profile-section-value">{user?.email}</p>
                </div>
                <div className="profile-section grid">
                  <div>
                    <p className="profile-section-title">Отдел</p>
                    <p className="profile-section-value">{employee?.department_name || '—'}</p>
                  </div>
                  <div>
                    <p className="profile-section-title">Статус</p>
                    <p className="profile-section-value">{employee?.is_manager ? 'Менеджер' : 'Сотрудник'}</p>
                  </div>
                </div>
                {employee?.hire_date && (
                  <div className="profile-section">
                    <p className="profile-section-title">В компании с</p>
                    <p className="profile-section-value">
                      {new Date(employee.hire_date).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                )}
                <button onClick={handleLogout} className="logout-btn">
                  <FiLogOut size={16} />
                  <span>Выйти из системы</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
