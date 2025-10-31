import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLogOut, FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../../contexts/ThemeContext';
import './Header.css';

const Header = ({ user, employee }) => {
  const [showProfile, setShowProfile] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  const getPositionLabel = (position) => {
    const positions = {
      product: 'Product Manager',
      ba: 'Business Analyst',
      front: 'Frontend Developer',
      back: 'Backend Developer',
      dev: 'Developer',
      project: 'Project Manager',
      designer: 'Designer'
    };
    return positions[position] || position;
  };

  return (
    <header className="header">
      <div className="header-content">
        <h1 className="logo">РАСТИ В ИТ</h1>
        
        <div className="header-actions">
          <button 
            onClick={toggleTheme} 
            className="icon-btn"
            title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
          >
            {theme === 'dark' ? <FiSun size={20} /> : <FiMoon size={20} />}
          </button>
          
          <div className="profile-dropdown">
            <button 
              onClick={() => setShowProfile(!showProfile)}
              className="profile-btn"
            >
              <FiUser size={20} />
            </button>
            
            {showProfile && (
              <div className="profile-menu">
                <div className="profile-info">
                  <h3>{employee?.user?.first_name} {employee?.user?.last_name}</h3>
                  <p className="profile-position">{getPositionLabel(employee?.position)}</p>
                  <p className="profile-email">{employee?.user?.email}</p>
                  {employee?.date_of_birth && (
                    <p className="profile-detail">Дата рождения: {new Date(employee.date_of_birth).toLocaleDateString('ru-RU')}</p>
                  )}
                  {employee?.hire_date && (
                    <p className="profile-detail">Дата приема: {new Date(employee.hire_date).toLocaleDateString('ru-RU')}</p>
                  )}
                  <p className="profile-detail">ID: {employee?.id}</p>
                </div>
                
                <button onClick={handleLogout} className="logout-btn">
                  <FiLogOut size={16} />
                  <span>Выйти</span>
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
