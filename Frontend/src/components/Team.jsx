import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCheckSquare,
  FiRefreshCw,
  FiSearch,
  FiTarget,
  FiUsers,
} from 'react-icons/fi';
import {
  getDepartments,
  getAllEmployees,
  getGoals,
  getTasks,
} from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import './Team.css';

const extractResults = (response) => {
  if (!response?.data) {
    return [];
  }
  if (Array.isArray(response.data?.results)) {
    return response.data.results;
  }
  return Array.isArray(response.data) ? response.data : response.data?.results || [];
};

function Team() {
  const { user, employee } = useAuth();
  const navigate = useNavigate();

  const isAdmin = Boolean(user?.is_superuser);
  const isManager = Boolean(employee?.is_manager);

  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [search, setSearch] = useState('');
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDepartments = async () => {
    try {
      const response = await getDepartments();
      setDepartments(extractResults(response));
    } catch (err) {
      console.error('Не удалось загрузить отделы', err);
    }
  };

  const loadData = async () => {
    if (!isAdmin && !isManager) {
      return;
    }

    setLoading(true);
    setError('');

    const params = { page_size: 500, ordering: 'user__last_name' };
    if (isAdmin && selectedDepartment !== 'all') {
      params.department = selectedDepartment;
    }
    if (!isAdmin && isManager && employee?.department) {
      params.department = employee.department;
    }

    try {
      const [employeesList, goalsRes, tasksRes] = await Promise.all([
        getAllEmployees(params),
        getGoals({ page_size: 500, ordering: '-created_at' }),
        getTasks({ page_size: 1000 }),
      ]);

      setMembers(employeesList || []);
      setGoals(extractResults(goalsRes));
      setTasks(extractResults(tasksRes));
    } catch (err) {
      console.error('Не удалось загрузить команду', err);
      setError('Не удалось загрузить данные. Попробуйте позже.');
      setMembers([]);
      setGoals([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadDepartments();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || isManager) {
      loadData();
    }
  }, [isAdmin, isManager, selectedDepartment]);

  const goalById = useMemo(() => {
    return goals.reduce((acc, goal) => {
      acc[goal.id] = goal;
      return acc;
    }, {});
  }, [goals]);

  const metricsByEmployee = useMemo(() => {
    const today = new Date();

    const goalMetrics = goals.reduce((acc, goal) => {
      if (!goal.employee) {
        return acc;
      }
      const current = acc[goal.employee] || { total: 0, overdue: 0 };
      current.total += 1;
      if (goal.end_date && new Date(goal.end_date) < today) {
        current.overdue += 1;
      }
      acc[goal.employee] = current;
      return acc;
    }, {});

    const taskMetrics = tasks.reduce((acc, task) => {
      const goal = goalById[task.goal];
      if (!goal?.employee) {
        return acc;
      }
      const current = acc[goal.employee] || { total: 0, completed: 0 };
      current.total += 1;
      if (task.is_completed) {
        current.completed += 1;
      }
      acc[goal.employee] = current;
      return acc;
    }, {});

    return { goalMetrics, taskMetrics };
  }, [goalById, goals, tasks]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return members;
    }

    return members.filter((member) => {
      const fullName = member.full_name?.toLowerCase() || '';
      const email = member.email?.toLowerCase() || '';
      const position = (
        member.position_name ||
        member.position_title ||
        ''
      ).toLowerCase();
      const department = member.department_name?.toLowerCase() || '';
      return [fullName, email, position, department].some((value) => value.includes(query));
    });
  }, [members, search]);

  const summary = useMemo(() => {
    const totalMembers = filteredMembers.length;
    const managersCount = filteredMembers.filter((member) => member.is_manager).length;
    const totalGoals = filteredMembers.reduce((sum, member) => {
      return sum + (metricsByEmployee.goalMetrics[member.id]?.total || 0);
    }, 0);
    const totalTasks = filteredMembers.reduce((sum, member) => {
      return sum + (metricsByEmployee.taskMetrics[member.id]?.total || 0);
    }, 0);

    return {
      totalMembers,
      managersCount,
      totalGoals,
      totalTasks,
    };
  }, [filteredMembers, metricsByEmployee.goalMetrics, metricsByEmployee.taskMetrics]);

  const handleAssignGoal = (member) => {
    navigate(`/goals?employee=${member.id}`);
  };

  const handleViewTasks = (member) => {
    navigate(`/tasks?employee=${member.id}`);
  };

  if (!isAdmin && !isManager) {
    return null;
  }

  return (
    <div className="page team-page">
      <header className="page-header">
        <div>
          <p className="page-overline">
            <FiUsers size={14} /> Работа с командой
          </p>
          <h1>{isAdmin ? 'Сотрудники компании' : 'Команда моего отдела'}</h1>
          <p className="page-subtitle">
            Просматривайте загрузку сотрудников, следите за целями и задачами и назначайте новые активности
          </p>
        </div>
        <div className="page-actions">
          <div className="input-with-icon">
            <FiSearch size={16} />
            <input
              type="search"
              placeholder="Поиск по имени, должности или отделу"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {isAdmin && (
            <select
              className="filter-select"
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value)}
            >
              <option value="all">Все отделы</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="btn ghost" onClick={loadData} disabled={loading}>
            <FiRefreshCw size={16} /> Обновить
          </button>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      <section className="summary-grid">
        <article className="summary-card">
          <FiUsers size={20} />
          <div>
            <p className="label">Сотрудников</p>
            <p className="value">{summary.totalMembers}</p>
          </div>
        </article>
        <article className="summary-card">
          <FiTarget size={20} />
          <div>
            <p className="label">Целей на команде</p>
            <p className="value">{summary.totalGoals}</p>
          </div>
        </article>
        <article className="summary-card">
          <FiCheckSquare size={20} />
          <div>
            <p className="label">Задач в работе</p>
            <p className="value">{summary.totalTasks}</p>
          </div>
        </article>
        <article className="summary-card">
          <FiUsers size={20} />
          <div>
            <p className="label">Менеджеры</p>
            <p className={`value ${summary.managersCount ? 'accent' : ''}`}>{summary.managersCount}</p>
          </div>
        </article>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div>
            <p className="panel-overline">Состав команды</p>
            <h2>Сотрудники</h2>
          </div>
        </header>

        <div className="table-wrapper">
          {loading ? (
            <div className="table-placeholder">Загружаем сотрудников…</div>
          ) : filteredMembers.length === 0 ? (
            <div className="table-placeholder empty">По условиям фильтра сотрудники не найдены.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Должность</th>
                  <th>Отдел</th>
                  <th>Цели</th>
                  <th>Задачи</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => {
                  const goalsInfo = metricsByEmployee.goalMetrics[member.id] || { total: 0, overdue: 0 };
                  const tasksInfo = metricsByEmployee.taskMetrics[member.id] || { total: 0, completed: 0 };
                  return (
                    <tr key={member.id}>
                      <td>
                        <div className="table-name">
                          <strong>{member.full_name || member.username}</strong>
                          <span>{member.email}</span>
                        </div>
                      </td>
                      <td>{member.position_name || member.position_title || '—'}</td>
                      <td>{member.department_name || '—'}</td>
                      <td>
                        <span className="metric">{goalsInfo.total}</span>
                        {goalsInfo.overdue > 0 && (
                          <span className="metric warning">Просрочено: {goalsInfo.overdue}</span>
                        )}
                      </td>
                      <td>
                        <span className="metric">{tasksInfo.total}</span>
                        {tasksInfo.total > 0 && (
                          <span className="metric success">Выполнено: {tasksInfo.completed}</span>
                        )}
                      </td>
                      <td>
                        <span className={`status ${member.is_manager ? 'status-on' : 'status-off'}`}>
                          {member.is_manager ? 'Менеджер' : 'Сотрудник'}
                        </span>
                      </td>
                      <td className="table-actions">
                        <button type="button" className="btn inline" onClick={() => handleAssignGoal(member)}>
                          Назначить цель
                        </button>
                        <button type="button" className="btn inline" onClick={() => handleViewTasks(member)}>
                          Задачи
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default Team;
