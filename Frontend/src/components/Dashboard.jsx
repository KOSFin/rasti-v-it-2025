import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../api/services';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await getCurrentUser();
      setUser(response.data.user);
      setEmployee(response.data.employee);
    } catch (error) {
      console.error('Error fetching user:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>РАСТИ В ИТ</h1>
        <div className="user-info">
          <span>{user?.first_name} {user?.last_name}</span>
          <button onClick={handleLogout} className="btn-logout">Выход</button>
        </div>
      </header>

      <div className="dashboard-content">
        <aside className="sidebar">
          <nav>
            <button onClick={() => navigate('/dashboard')} className="nav-item active">
              <span>📊</span> Главная
            </button>
            <button onClick={() => navigate('/goals')} className="nav-item">
              <span>🎯</span> Цели
            </button>
            <button onClick={() => navigate('/tasks')} className="nav-item">
              <span>✓</span> Задачи
            </button>
            <button onClick={() => navigate('/self-assessment')} className="nav-item">
              <span>📝</span> Самооценка
            </button>
            <button onClick={() => navigate('/feedback-360')} className="nav-item">
              <span>👥</span> Оценка 360
            </button>
            {employee?.is_manager && (
              <>
                <button onClick={() => navigate('/manager-reviews')} className="nav-item">
                  <span>⭐</span> Оценки сотрудников
                </button>
                <button onClick={() => navigate('/potential-assessment')} className="nav-item">
                  <span>📈</span> Оценка потенциала
                </button>
                <button onClick={() => navigate('/nine-box')} className="nav-item">
                  <span>📊</span> 9-Box матрица
                </button>
              </>
            )}
            <button onClick={() => navigate('/final-reviews')} className="nav-item">
              <span>📄</span> Итоговые отчеты
            </button>
          </nav>
        </aside>

        <main className="main-content">
          <div className="welcome-section">
            <h2>Добро пожаловать, {user?.first_name}!</h2>
            <p className="subtitle">
              {employee?.position} {employee?.department_name && `в ${employee.department_name}`}
            </p>
          </div>

          <div className="dashboard-cards">
            <div className="card">
              <h3>Мои цели</h3>
              <p>Управляйте своими целями и задачами</p>
              <button onClick={() => navigate('/goals')} className="btn-card">
                Перейти →
              </button>
            </div>

            <div className="card">
              <h3>Самооценка</h3>
              <p>Оцените свои достижения</p>
              <button onClick={() => navigate('/self-assessment')} className="btn-card">
                Перейти →
              </button>
            </div>

            <div className="card">
              <h3>Обратная связь 360°</h3>
              <p>Дайте оценку коллегам</p>
              <button onClick={() => navigate('/feedback-360')} className="btn-card">
                Перейти →
              </button>
            </div>

            {employee?.is_manager && (
              <>
                <div className="card">
                  <h3>Оценка сотрудников</h3>
                  <p>Оцените работу вашей команды</p>
                  <button onClick={() => navigate('/manager-reviews')} className="btn-card">
                    Перейти →
                  </button>
                </div>

                <div className="card">
                  <h3>9-Box матрица</h3>
                  <p>Визуализация потенциала команды</p>
                  <button onClick={() => navigate('/nine-box')} className="btn-card">
                    Перейти →
                  </button>
                </div>
              </>
            )}

            <div className="card">
              <h3>Итоговые отчеты</h3>
              <p>Просмотр финальных оценок</p>
              <button onClick={() => navigate('/final-reviews')} className="btn-card">
                Перейти →
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
