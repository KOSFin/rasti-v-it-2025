import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogIn, FiLock, FiMoon, FiShield, FiSun, FiUser } from 'react-icons/fi';
import { login } from '../api/services';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

function Login() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { refreshProfile } = useAuth();
  const [formState, setFormState] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(formState.username, formState.password);
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('employee', JSON.stringify(response.data.employee));
      await refreshProfile();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка входа. Проверьте данные.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-spotlight" />
      <button type="button" className="auth-theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
      </button>

      <div className="auth-shell">
        <header className="auth-brand">
          <div className="brand-mark">RV</div>
          <div className="brand-meta">
            <span className="brand-name">РАСТИ В ИТ</span>
            <span className="brand-tag">платформа оценки и развития</span>
          </div>
        </header>

        <main className="auth-panel">
          <header className="auth-header">
            <FiShield size={18} />
            <div>
              <h1>Вход в личный кабинет</h1>
              <p>Используйте корпоративные учетные данные для доступа к платформе.</p>
            </div>
          </header>

          {error && <div className="auth-banner error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>
                <FiUser size={16} /> Имя пользователя
              </span>
              <input
                name="username"
                value={formState.username}
                onChange={handleChange}
                placeholder="admin"
                required
                disabled={loading}
                autoFocus
              />
            </label>

            <label className="auth-field">
              <span>
                <FiLock size={16} /> Пароль
              </span>
              <input
                type="password"
                name="password"
                value={formState.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </label>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Проверяем…' : (
                <>
                  <FiLogIn size={18} />
                  <span>Войти</span>
                </>
              )}
            </button>
          </form>

          <footer className="auth-footer">
            <p>
              Базовая учетная запись администратора: <strong>admin / admin</strong>. После входа создайте
              личные профили сотрудников в разделе «Сотрудники».
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default Login;
