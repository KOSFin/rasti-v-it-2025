import { useMemo, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FiHome,
  FiTarget,
  FiFileText,
  FiUsers,
  FiGrid,
  FiBarChart2,
  FiUserPlus,
  FiTrendingUp,
  FiClock,
  FiCheck,
  FiLayers,
  FiUserCheck,
  FiGitBranch,
  FiBookOpen,
  FiX,
} from 'react-icons/fi';
import { getGoals, getTasks, updateTask } from '../../api/services';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const { employee, user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const role = employee?.role || (user?.is_superuser ? 'admin' : null);
  const isAdmin = role === 'admin' || user?.is_superuser;
  const isManager = role === 'manager';
  const isBusinessPartner = role === 'business_partner';
  const canSeeNineBox = isAdmin || isManager || isBusinessPartner;

  const fetchSidebarData = async () => {
    if (!employee) {
      return;
    }

    setLoading(true);

    try {
      const [goalsRes, tasksRes] = await Promise.all([
        getGoals({ page_size: 100, ordering: '-created_at' }),
        getTasks({ page_size: 200 })
      ]);

      const goalsData = Array.isArray(goalsRes.data?.results)
        ? goalsRes.data.results
        : goalsRes.data;
      const tasksData = Array.isArray(tasksRes.data?.results)
        ? tasksRes.data.results
        : tasksRes.data;

      setGoals(goalsData || []);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Не удалось получить данные для бокового меню', error);
      setGoals([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSidebarData();
  }, [role]);

  const goalById = useMemo(() => {
    return goals.reduce((acc, goal) => {
      acc[goal.id] = goal;
      return acc;
    }, {});
  }, [goals]);

  const analytics = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.is_completed).length;
    const now = new Date();

    const dueSoonGoals = goals.filter((goal) => {
      if (!goal.end_date) {
        return false;
      }
      const deadline = new Date(goal.end_date);
      const diff = (deadline - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;

    const overdueGoals = goals.filter((goal) => {
      if (!goal.end_date) {
        return false;
      }
      return new Date(goal.end_date) < now;
    }).length;

    return {
      totalGoals: goals.length,
      totalTasks,
      completedTasks,
      completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
      dueSoonGoals,
      overdueGoals,
    };
  }, [goals, tasks]);

  const nextTasks = useMemo(() => {
    return tasks
      .filter((task) => !task.is_completed)
      .slice(0, 5)
      .map((task) => ({
        ...task,
        goalTitle: goalById[task.goal]?.title,
        goalDeadline: goalById[task.goal]?.end_date,
      }));
  }, [tasks, goalById]);

  const upcomingGoals = useMemo(() => {
    const now = new Date();
    return goals
      .filter((goal) => goal.end_date && new Date(goal.end_date) >= now)
      .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))
      .slice(0, 3);
  }, [goals]);

  const handleToggleTask = async (task) => {
    try {
      await updateTask(task.id, {
        goal: task.goal,
        title: task.title,
        description: task.description,
        is_completed: !task.is_completed,
      });
      await fetchSidebarData();
    } catch (error) {
      console.error('Не удалось обновить задачу', error);
    }
  };

  const navSections = useMemo(() => {
    const sections = [];

    const mainItems = [
      { path: '/dashboard', icon: FiHome, label: 'Обзор' },
      { path: '/goals', icon: FiTarget, label: isManager || isAdmin ? 'Цели и задачи' : 'Мои цели' },
      ...(!isAdmin && !isManager ? [{ path: '/colleagues', icon: FiUsers, label: 'Коллеги' }] : []),
      { path: '/skills-assessments', icon: FiTrendingUp, label: 'Навыки' },
      { path: '/self-assessment', icon: FiFileText, label: 'Самооценка' },
      { path: '/feedback-360', icon: FiUserCheck, label: 'Оценка 360°' },
    ].filter(Boolean);

    sections.push({ label: 'Рабочая зона', items: mainItems });

    if (isManager || isAdmin) {
      const teamItems = [
        { path: '/team', icon: FiUsers, label: 'Команда' },
        { path: '/reports', icon: FiBarChart2, label: 'Отчеты' },
      ];
      if (canSeeNineBox) {
        teamItems.push({ path: '/nine-box', icon: FiGrid, label: 'Nine Box' });
      }
      sections.push({ label: 'Управление командой', items: teamItems });
    } else if (canSeeNineBox) {
      sections.push({ label: 'Аналитика', items: [{ path: '/nine-box', icon: FiGrid, label: 'Nine Box' }] });
    }

    if (isAdmin) {
      sections.push({
        label: 'Администрирование',
        items: [
          { path: '/admin/users', icon: FiUserPlus, label: 'Сотрудники' },
          { path: '/admin/departments', icon: FiLayers, label: 'Отделы' },
          { path: '/admin/teams', icon: FiGitBranch, label: 'Команды' },
          { path: '/admin/skill-questions', icon: FiBookOpen, label: 'Навыковые вопросы' },
        ],
      });
    }

    return sections.filter((section) => section.items.length > 0);
  }, [canSeeNineBox, isAdmin, isManager]);

  const handleLinkClick = () => {
    if (window.innerWidth <= 768) {
      onClose?.();
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      <button className="sidebar-close-btn" onClick={onClose} aria-label="Закрыть меню">
        <FiX size={24} />
      </button>
      
      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.label} className="sidebar-section">
            <p className="sidebar-section-label">{section.label}</p>
            <div className="sidebar-links">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={handleLinkClick}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-panels">
        {loading ? (
          <div className="sidebar-card loading">
            <div className="loader" />
            <span>Обновляем данные…</span>
          </div>
        ) : (
          <>
            <div className="sidebar-card stats">
              <div className="card-header">
                <FiTrendingUp size={16} />
                <span>Активность</span>
              </div>
              <div className="stats-grid">
                <div>
                  <p className="label">Цели</p>
                  <p className="value">{analytics.totalGoals}</p>
                </div>
                <div>
                  <p className="label">Задачи</p>
                  <p className="value">{analytics.totalTasks}</p>
                </div>
                <div>
                  <p className="label">Выполнено</p>
                  <p className="value success">{analytics.completedTasks}</p>
                </div>
                <div>
                  <p className="label">Прогресс</p>
                  <p className="value accent">{analytics.completionRate}%</p>
                </div>
              </div>
            </div>

            {isManager ? (
              <div className="sidebar-card manager">
                <div className="card-header">
                  <FiClock size={16} />
                  <span>Срез команды</span>
                </div>
                <div className="manager-highlight">
                  <div>
                    <p className="label">Горящие цели</p>
                    <p className="value warning">{analytics.dueSoonGoals}</p>
                  </div>
                  <div>
                    <p className="label">Просрочено</p>
                    <p className="value danger">{analytics.overdueGoals}</p>
                  </div>
                </div>
                <ul className="compact-list">
                  {upcomingGoals.length === 0 && <li className="muted">Сейчас без критичных дедлайнов</li>}
                  {upcomingGoals.map((goal) => (
                    <li key={goal.id}>
                      <strong>{goal.title}</strong>
                      <span>{new Date(goal.end_date).toLocaleDateString('ru-RU')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="sidebar-card tasks">
                <div className="card-header">
                  <FiCheck size={16} />
                  <span>Ближайшие задачи</span>
                </div>
                <ul className="task-list">
                  {nextTasks.length === 0 && <li className="muted">Свободных задач нет</li>}
                  {nextTasks.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        className={`task-toggle ${task.is_completed ? 'done' : ''}`}
                        aria-pressed={task.is_completed}
                      >
                        <span className="checkbox" />
                        <div className="task-body">
                          <p>{task.title}</p>
                          {task.goalDeadline && (
                            <small>
                              {task.goalTitle ? `${task.goalTitle} • ` : ''}
                              до {new Date(task.goalDeadline).toLocaleDateString('ru-RU')}
                            </small>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
