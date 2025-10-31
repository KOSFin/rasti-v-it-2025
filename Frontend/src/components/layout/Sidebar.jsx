import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FiHome, 
  FiTarget, 
  FiCheckSquare, 
  FiFileText, 
  FiUsers, 
  FiGrid, 
  FiChevronDown,
  FiChevronRight,
  FiBarChart2,
  FiUserPlus
} from 'react-icons/fi';
import api from '../../api/axios';
import './Sidebar.css';

const Sidebar = ({ employee }) => {
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedGoal, setExpandedGoal] = useState(null);

  const isManager = employee?.is_manager;

  useEffect(() => {
    if (isManager) {
      fetchTeamStats();
    } else {
      fetchMyGoalsAndTasks();
    }
  }, [isManager]);

  const fetchMyGoalsAndTasks = async () => {
    try {
      setLoading(true);
      const goalsRes = await api.get('/goals/', {
        params: { employee: employee?.id, page_size: 5, ordering: '-created_at' }
      });
      setGoals(goalsRes.data.results || goalsRes.data || []);
      
      const tasksRes = await api.get('/tasks/', {
        params: { is_completed: false, page_size: 10 }
      });
      setTasks(tasksRes.data.results || tasksRes.data || []);
    } catch (error) {
      console.error('Error fetching goals and tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamStats = async () => {
    try {
      setLoading(true);
      const [tasksRes, goalsRes] = await Promise.all([
        api.get('/tasks/', { params: { page_size: 100 } }),
        api.get('/goals/', { params: { page_size: 100 } })
      ]);
      
      const allTasks = tasksRes.data.results || tasksRes.data || [];
      const allGoals = goalsRes.data.results || goalsRes.data || [];
      
      const completedTasks = allTasks.filter(t => t.is_completed).length;
      const completedGoals = allGoals.filter(g => g.status === 'completed').length;
      
      setStats({
        totalTasks: allTasks.length,
        completedTasks,
        totalGoals: allGoals.length,
        completedGoals,
        teamMembers: 0 // TODO: получить из API
      });
    } catch (error) {
      console.error('Error fetching team stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskComplete = async (taskId, currentStatus) => {
    try {
      await api.patch(`/tasks/${taskId}/`, { is_completed: !currentStatus });
      if (isManager) {
        fetchTeamStats();
      } else {
        fetchMyGoalsAndTasks();
      }
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const toggleGoal = (goalId) => {
    setExpandedGoal(expandedGoal === goalId ? null : goalId);
  };

  const navItems = [
    { path: '/dashboard', icon: FiHome, label: 'Главная' },
    { path: '/goals', icon: FiTarget, label: 'Цели' },
    { path: '/tasks', icon: FiCheckSquare, label: 'Задачи' },
    { path: '/self-assessment', icon: FiFileText, label: 'Самооценка' },
    { path: '/feedback-360', icon: FiUsers, label: 'Оценка 360°' },
    { path: '/nine-box', icon: FiGrid, label: 'Nine Box' },
  ];

  if (isManager) {
    navItems.splice(1, 0, 
      { path: '/team', icon: FiUserPlus, label: 'Команда' },
      { path: '/reports', icon: FiBarChart2, label: 'Отчеты' }
    );
  }

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : isManager ? (
          <div className="stats-widget">
            <h3>Статистика команды</h3>
            <div className="stat-item">
              <span className="stat-label">Всего задач</span>
              <span className="stat-value">{stats?.totalTasks || 0}</span>
            </div>
            <div className="stat-item success">
              <span className="stat-label">Выполнено</span>
              <span className="stat-value">{stats?.completedTasks || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Всего целей</span>
              <span className="stat-value">{stats?.totalGoals || 0}</span>
            </div>
            <div className="stat-item success">
              <span className="stat-label">Завершено</span>
              <span className="stat-value">{stats?.completedGoals || 0}</span>
            </div>
          </div>
        ) : (
          <div className="quick-tasks">
            <h3>Мои цели и задачи</h3>
            <div className="goals-list">
              {goals.slice(0, 3).map(goal => (
                <div key={goal.id} className="goal-item">
                  <div 
                    className="goal-header" 
                    onClick={() => toggleGoal(goal.id)}
                  >
                    <span className="goal-title">{goal.title}</span>
                    {expandedGoal === goal.id ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                  </div>
                  {expandedGoal === goal.id && (
                    <div className="goal-tasks">
                      {tasks
                        .filter(t => t.goal === goal.id)
                        .slice(0, 3)
                        .map(task => (
                          <div key={task.id} className="task-item">
                            <input
                              type="checkbox"
                              checked={task.is_completed}
                              onChange={() => toggleTaskComplete(task.id, task.is_completed)}
                              className="task-checkbox"
                            />
                            <span className={task.is_completed ? 'completed' : ''}>
                              {task.title}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
