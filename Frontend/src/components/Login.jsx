import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLock, FiLogIn, FiMoon, FiSun } from 'react-icons/fi';
import { login } from '../api/services';
import { useTheme } from '../contexts/ThemeContext';
import './Auth.css';

function Login() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(formData.username, formData.password);
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('employee', JSON.stringify(response.data.employee));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка входа. Проверьте данные.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <button onClick={toggleTheme} className="theme-toggle-login">
        {theme === 'dark' ? <FiSun size={20} /> : <FiMoon size={20} />}
      </button>
      
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-logo">РАСТИ В ИТ</h1>
          <p className="auth-subtitle">Система оценки эффективности</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">
              <FiUser size={16} />
              <span>Имя пользователя</span>
            </label>
            <input
              type="text"
              name="username"
              className="form-input"
              value={formData.username}
              onChange={handleChange}
              placeholder="Введите имя пользователя"
              required
              disabled={loading}
              autoFocus
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">
              <FiLock size={16} />
              <span>Пароль</span>
            </label>
            <input
              type="password"
              name="password"
              className="form-input"
              value={formData.password}
              onChange={handleChange}
              placeholder="Введите пароль"
              required
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="error-message">
              <span>{error}</span>
            </div>
          )}
          
          <button type="submit" disabled={loading} className="btn-login">
            {loading ? (
              <>
                <span className="spinner"></span>
                <span>Вход...</span>
              </>
            ) : (
              <>
                <FiLogIn size={20} />
                <span>Войти</span>
              </>
            )}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>Используйте свои корпоративные учетные данные</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
