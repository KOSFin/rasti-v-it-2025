import { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiSearch, FiFilter, FiTrash2, FiCalendar, FiExternalLink } from 'react-icons/fi';
import { getGoals, getTasks, createGoal, deleteGoal } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
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

const initialFormState = {
  title: '',
  description: '',
  goal_type: 'tactical',
  start_date: '',
  end_date: '',
  expected_results: '',
  task_link: '',
};

function Goals() {
  const { employee } = useAuth();
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [goalsRes, tasksRes] = await Promise.all([
        getGoals({ page_size: 200, ordering: '-created_at' }),
        getTasks({ page_size: 400 }),
      ]);

      setGoals(extractResults(goalsRes));
      setTasks(extractResults(tasksRes));
    } catch (err) {
      console.error('Не удалось загрузить цели', err);
      setError('Не удалось загрузить цели. Попробуйте обновить страницу.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const tasksByGoal = useMemo(() => {
    return tasks.reduce((acc, task) => {
      acc[task.goal] = acc[task.goal] ? [...acc[task.goal], task] : [task];
      return acc;
    }, {});
  }, [tasks]);

  const filteredGoals = useMemo(() => {
    return goals.filter((goal) => {
      const matchesType = filterType === 'all' || goal.goal_type === filterType;
      const matchesSearch = goal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        goal.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [goals, filterType, searchTerm]);

  const formChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (formData.start_date && formData.end_date && formData.end_date < formData.start_date) {
      setFormError('Дата окончания должна быть позже даты начала.');
      return;
    }

    setSaving(true);

    try {
      await createGoal(formData);
      setShowForm(false);
      setFormData(initialFormState);
      await loadData();
    } catch (err) {
      console.error('Не удалось создать цель', err);
      setFormError('Не удалось создать цель. Проверьте данные и попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Удалить цель и связанные задачи?');
    if (!confirmed) {
      return;
    }

    try {
      await deleteGoal(id);
      await loadData();
    } catch (err) {
      console.error('Не удалось удалить цель', err);
      setError('Удаление не удалось. Попробуйте позже.');
    }
  };

  const getProgress = (goalId) => {
    const relatedTasks = tasksByGoal[goalId] || [];
    const completed = relatedTasks.filter((task) => task.is_completed).length;
    const total = relatedTasks.length;
    return {
      completed,
      total,
      percentage: total ? Math.round((completed / total) * 100) : 0,
    };
  };

  const goalTypeLabel = (type) => {
    switch (type) {
      case 'strategic':
        return 'Стратегическая цель';
      case 'personal':
        return 'Личное развитие';
      default:
        return 'Тактическая задача';
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Цели</h1>
          <p className="page-subtitle">
            Управляйте стратегическими и персональными целями {employee?.department_name ? `команды ${employee.department_name}` : 'команды'}
          </p>
        </div>
        <div className="page-actions">
          <div className="input-with-icon">
            <FiSearch size={16} />
            <input
              type="search"
              placeholder="Поиск по названию или описанию"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="input-with-icon select">
            <FiFilter size={16} />
            <select value={filterType} onChange={(event) => setFilterType(event.target.value)}>
              <option value="all">Все цели</option>
              <option value="strategic">Стратегические</option>
              <option value="tactical">Тактические</option>
              <option value="personal">Личное развитие</option>
            </select>
          </div>
          <button type="button" className="btn primary" onClick={() => setShowForm((prev) => !prev)}>
            <FiPlus size={16} /> {showForm ? 'Скрыть форму' : 'Новая цель'}
          </button>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      {showForm && (
        <section className="panel">
          <header className="panel-header">
            <h2>Создать цель</h2>
            <span>Определите параметры новой цели</span>
          </header>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Название *</span>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={formChange}
                placeholder="Например, Запуск новой версии портала"
                required
              />
            </label>
            <label className="form-field span-2">
              <span>Описание *</span>
              <textarea
                name="description"
                value={formData.description}
                onChange={formChange}
                rows={4}
                placeholder="Опишите ключевые параметры и ожидаемый результат"
                required
              />
            </label>
            <label className="form-field">
              <span>Тип цели *</span>
              <select name="goal_type" value={formData.goal_type} onChange={formChange} required>
                <option value="strategic">Стратегическая</option>
                <option value="tactical">Тактическая</option>
                <option value="personal">Личное развитие</option>
              </select>
            </label>
            <label className="form-field">
              <span>Дата начала *</span>
              <input type="date" name="start_date" value={formData.start_date} onChange={formChange} required />
            </label>
            <label className="form-field">
              <span>Дата завершения *</span>
              <input type="date" name="end_date" value={formData.end_date} onChange={formChange} required />
            </label>
            <label className="form-field span-2">
              <span>Ожидаемый результат *</span>
              <textarea
                name="expected_results"
                value={formData.expected_results}
                onChange={formChange}
                rows={3}
                placeholder="Какие конкретные показатели будут считаться успешными?"
                required
              />
            </label>
            <label className="form-field span-2">
              <span>Сопутствующая ссылка</span>
              <input
                type="url"
                name="task_link"
                value={formData.task_link}
                onChange={formChange}
                placeholder="https://..."
              />
            </label>

            {formError && <div className="form-hint error">{formError}</div>}

            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>
                Отменить
              </button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Сохраняем…' : 'Создать цель'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="page-section">
        {loading ? (
          <div className="panel placeholder">Загружаем цели…</div>
        ) : filteredGoals.length === 0 ? (
          <div className="panel empty">
            <p>Целей по заданным условиям не найдено.</p>
            <button type="button" className="btn ghost" onClick={() => setShowForm(true)}>
              Создать новую цель
            </button>
          </div>
        ) : (
          <div className="cards-grid">
            {filteredGoals.map((goal) => {
              const progress = getProgress(goal.id);
              return (
                <article key={goal.id} className="card goal-card">
                  <header className="card-header">
                    <div>
                      <h3>{goal.title}</h3>
                      <span className={`badge ${goal.goal_type}`}>{goalTypeLabel(goal.goal_type)}</span>
                    </div>
                    <button type="button" className="icon-btn" onClick={() => handleDelete(goal.id)}>
                      <FiTrash2 size={16} />
                    </button>
                  </header>

                  <p className="card-description">{goal.description}</p>

                  <div className="card-row">
                    <span>
                      <FiCalendar size={14} /> {goal.start_date ? new Date(goal.start_date).toLocaleDateString('ru-RU') : '—'}
                    </span>
                    <span>
                      <FiCalendar size={14} /> {goal.end_date ? new Date(goal.end_date).toLocaleDateString('ru-RU') : '—'}
                    </span>
                  </div>

                  <div className="progress">
                    <div className="progress-track">
                      <div className="progress-bar" style={{ width: `${progress.percentage}%` }} />
                    </div>
                    <span>{progress.completed}/{progress.total || 0} задач выполнено</span>
                  </div>

                  <div className="card-meta">
                    <span>Ожидаемый результат</span>
                    <p>{goal.expected_results}</p>
                  </div>

                  <footer className="card-footer">
                    {goal.task_link && (
                      <a href={goal.task_link} target="_blank" rel="noopener noreferrer">
                        <FiExternalLink size={14} /> Материалы
                      </a>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Goals;
