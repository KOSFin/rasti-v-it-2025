import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiPlus, FiList, FiCheckSquare, FiTrash2, FiUsers } from 'react-icons/fi';
import { getTasks, getGoals, createTask, updateTask, deleteTask } from '../api/services';
import './Common.css';

const extractResults = (response) => {
  if (!response?.data) {
    return [];
  }
  if (Array.isArray(response.data?.results)) {
    return response.data.results;
  }
  return Array.isArray(response.data) ? response.data : response.data?.results || [];
};

const defaultForm = {
  goal: '',
  title: '',
  description: '',
  is_completed: false,
};

function Tasks() {
  const [searchParams] = useSearchParams();
  const filterGoalParam = searchParams.get('goal');
  const filterEmployeeParam = searchParams.get('employee');

  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [filterGoal, setFilterGoal] = useState(filterGoalParam || 'all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterEmployee, setFilterEmployee] = useState(filterEmployeeParam || 'all');

  useEffect(() => {
    setFilterGoal(filterGoalParam || 'all');
    setFilterEmployee(filterEmployeeParam || 'all');
  }, [filterGoalParam, filterEmployeeParam]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [tasksRes, goalsRes] = await Promise.all([
        getTasks({ page_size: 400 }),
        getGoals({ page_size: 200, ordering: '-created_at' }),
      ]);

      setTasks(extractResults(tasksRes));
      setGoals(extractResults(goalsRes));
    } catch (err) {
      console.error('Не удалось загрузить задачи', err);
      setError('Не удалось загрузить задачи. Попробуйте обновить страницу.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const goalMap = useMemo(() => {
    return goals.reduce((acc, goal) => {
      acc[goal.id] = goal;
      return acc;
    }, {});
  }, [goals]);

  const employeeOptions = useMemo(() => {
    const entries = new Map();
    goals.forEach((goal) => {
      if (goal.employee) {
        const label = goal.employee_name || `Сотрудник #${goal.employee}`;
        entries.set(goal.employee, label);
      }
    });
    return Array.from(entries, ([id, name]) => ({ id, name }));
  }, [goals]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesGoal = filterGoal === 'all' || String(task.goal) === String(filterGoal);
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && !task.is_completed) ||
        (filterStatus === 'completed' && task.is_completed);
      const ownerId = goalMap[task.goal]?.employee;
      const matchesEmployee = filterEmployee === 'all' || String(ownerId) === String(filterEmployee);
      return matchesGoal && matchesStatus && matchesEmployee;
    });
  }, [tasks, filterGoal, filterStatus, filterEmployee, goalMap]);

  const groupedTasks = useMemo(() => {
    return filteredTasks.reduce((acc, task) => {
      const key = task.goal;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(task);
      return acc;
    }, {});
  }, [filteredTasks]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.goal) {
      setError('Выберите цель для задачи.');
      return;
    }

    setSaving(true);

    try {
      await createTask({
        ...formData,
        goal: Number(formData.goal),
      });
      setFormData(defaultForm);
      setShowForm(false);
      await loadData();
    } catch (err) {
      console.error('Не удалось создать задачу', err);
      setError('Создание задачи не удалось. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task) => {
    try {
      await updateTask(task.id, {
        goal: task.goal,
        title: task.title,
        description: task.description,
        is_completed: !task.is_completed,
      });
      await loadData();
    } catch (err) {
      console.error('Не удалось обновить задачу', err);
      setError('Обновление задачи не удалось.');
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Удалить задачу?')) {
      return;
    }

    try {
      await deleteTask(taskId);
      await loadData();
    } catch (err) {
      console.error('Не удалось удалить задачу', err);
      setError('Удаление задачи не удалось.');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Задачи</h1>
          <p className="page-subtitle">Следите за прогрессом по ключевым задачам и закрывайте их вовремя</p>
        </div>
        <div className="page-actions">
          <div className="input-with-icon select">
            <FiList size={16} />
            <select value={filterGoal} onChange={(event) => setFilterGoal(event.target.value)}>
              <option value="all">Все цели</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </div>
          <div className="input-with-icon select">
            <FiCheckSquare size={16} />
            <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
              <option value="active">Активные</option>
              <option value="completed">Выполненные</option>
              <option value="all">Все задачи</option>
            </select>
          </div>
          {employeeOptions.length > 0 && (
            <div className="input-with-icon select">
              <FiUsers size={16} />
              <select value={filterEmployee} onChange={(event) => setFilterEmployee(event.target.value)}>
                <option value="all">Все сотрудники</option>
                {employeeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="button" className="btn primary" onClick={() => setShowForm((prev) => !prev)}>
            <FiPlus size={16} /> {showForm ? 'Скрыть форму' : 'Добавить задачу'}
          </button>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      {showForm && (
        <section className="panel">
          <header className="panel-header">
            <h2>Новая задача</h2>
            <span>Привяжите задачу к цели, чтобы отслеживать прогресс</span>
          </header>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Цель *</span>
              <select name="goal" value={formData.goal} onChange={handleChange} required>
                <option value="">Выберите цель</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.employee_name ? `${goal.title} — ${goal.employee_name}` : goal.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Название *</span>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Например, Подготовить презентацию для совета"
                required
              />
            </label>
            <label className="form-field span-2">
              <span>Описание *</span>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="Опишите ожидаемый результат и ключевые шаги"
                required
              />
            </label>
            <label className="form-field checkbox">
              <input
                type="checkbox"
                name="is_completed"
                checked={formData.is_completed}
                onChange={handleChange}
              />
              <span>Задача уже выполнена</span>
            </label>
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>
                Отменить
              </button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Сохраняем…' : 'Создать задачу'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="page-section">
        {loading ? (
          <div className="panel placeholder">Загружаем задачи…</div>
        ) : filteredTasks.length === 0 ? (
          <div className="panel empty">
            <p>По выбранным фильтрам задачи не найдены.</p>
            <button type="button" className="btn ghost" onClick={() => setShowForm(true)}>
              Добавить задачу
            </button>
          </div>
        ) : (
          <div className="cards-grid">
            {Object.entries(groupedTasks).map(([goalId, goalTasks]) => {
              const goal = goalMap[goalId];
              const total = goalTasks.length;
              const completed = goalTasks.filter((task) => task.is_completed).length;
              const percentage = total ? Math.round((completed / total) * 100) : 0;

              return (
                <article key={goalId} className="card task-card">
                  <header className="card-header">
                    <div>
                      <h3>{goal?.title || 'Без цели'}</h3>
                      <span className="card-meta">
                        {goal?.goal_type === 'strategic' ? 'Стратегическая цель' : goal?.goal_type === 'personal' ? 'Личное развитие' : 'Тактическая задача'}
                      </span>
                    </div>
                    <span className="card-progress">{percentage}%</span>
                  </header>
                  <ul className="task-list">
                    {goalTasks.map((task) => (
                      <li key={task.id} className={task.is_completed ? 'done' : ''}>
                        <button
                          type="button"
                          className="task-toggle"
                          onClick={() => handleToggle(task)}
                          aria-pressed={task.is_completed}
                        >
                          <span className="checkbox" />
                          <div>
                            <strong>{task.title}</strong>
                            <span>{task.description}</span>
                          </div>
                        </button>
                        <button type="button" className="icon-btn" onClick={() => handleDelete(task.id)}>
                          <FiTrash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Tasks;
