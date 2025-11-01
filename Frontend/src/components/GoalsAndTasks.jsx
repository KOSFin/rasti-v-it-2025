import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  FiPlus, FiSearch, FiFilter, FiTrash2, FiCalendar, FiExternalLink, 
  FiUsers, FiChevronDown, FiChevronRight, FiCheckCircle, FiCircle, FiEdit2
} from 'react-icons/fi';
import { 
  getGoals, createGoal, updateGoal, deleteGoal, completeGoal,
  createTask, updateTask, deleteTask, getEmployees 
} from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import './Common.css';
import './GoalsAndTasks.css';

const extractResults = (response) => {
  if (!response?.data) return [];
  if (Array.isArray(response.data?.results)) return response.data.results;
  return Array.isArray(response.data) ? response.data : response.data?.results || [];
};

// Форматирование даты в РФ формат (дд.мм.гггг)
const formatDateRU = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

// Получить сегодняшнюю дату в формате yyyy-mm-dd
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Получить дату через неделю в формате yyyy-mm-dd
const getDateAfterWeek = () => {
  const today = new Date();
  today.setDate(today.getDate() + 7);
  return today.toISOString().split('T')[0];
};

// Вычислить количество дней до дедлайна
const getDaysUntilDeadline = (dateString) => {
  if (!dateString) return null;
  const deadline = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const diff = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  return diff;
};

const initialGoalForm = {
  title: '',
  description: '',
  goal_type: 'tactical',
  start_date: getTodayDate(),
  end_date: getDateAfterWeek(),
  expected_results: '',
  task_link: '',
  employee: '',
  requires_evaluation: false,
};

const initialTaskForm = {
  title: '',
  description: '',
};

function GoalsAndTasks() {
  const { employee, user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [goals, setGoals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalFormData, setGoalFormData] = useState(initialGoalForm);
  const [goalFormError, setGoalFormError] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  
  const [expandedGoals, setExpandedGoals] = useState(new Set());
  const [editingTask, setEditingTask] = useState(null);
  const [taskFormData, setTaskFormData] = useState(initialTaskForm);
  const [showTaskForm, setShowTaskForm] = useState(null); // goalId
  
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  
  const [completingGoal, setCompletingGoal] = useState(null);
  const [completeModalData, setCompleteModalData] = useState(null);
  const [pendingTaskIds, setPendingTaskIds] = useState([]);
  const pendingTimersRef = useRef({});

  const isManager = Boolean(employee?.is_manager);
  const isAdmin = Boolean(user?.is_superuser);
  const canAssign = isAdmin || isManager;

  const updateGoalTaskState = (goalId, taskId, updater) => {
    setGoals((prevGoals) =>
      prevGoals.map((goalItem) => {
        if (goalItem.id !== goalId) {
          return goalItem;
        }

        const originalTasks = goalItem.tasks || [];
        const updatedTasks = originalTasks.map((taskItem) => {
          if (taskItem.id !== taskId) {
            return taskItem;
          }

          const patch = typeof updater === 'function' ? updater(taskItem) : updater;
          return { ...taskItem, ...patch };
        });

        const tasksCompleted = updatedTasks.filter((item) => item.is_completed).length;

        return {
          ...goalItem,
          tasks: updatedTasks,
          tasks_completed: tasksCompleted,
          tasks_total: updatedTasks.length,
        };
      })
    );
  };

  const addPendingTask = (taskId) => {
    setPendingTaskIds((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
  };

  const removePendingTask = (taskId) => {
    setPendingTaskIds((prev) => prev.filter((id) => id !== taskId));
  };

  const clearPendingTimer = (taskId) => {
    const storedTimer = pendingTimersRef.current[taskId];
    if (storedTimer) {
      clearTimeout(storedTimer);
      delete pendingTimersRef.current[taskId];
    }
  };

  const loadData = async ({ showLoader = true } = {}) => {
    if (showLoader) {
      setLoading(true);
    }
    setError('');

    try {
      const goalsRes = await getGoals({ page_size: 200, ordering: '-created_at' });
      setGoals(extractResults(goalsRes));
    } catch (err) {
      console.error('Не удалось загрузить цели', err);
      setError('Не удалось загрузить цели. Попробуйте обновить страницу.');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const loadEmployees = async () => {
    if (!canAssign) return;

    const params = { page_size: 300, ordering: 'user__last_name' };
    if (isManager && employee?.department) {
      params.department = employee.department;
    }

    try {
      const response = await getEmployees(params);
      setEmployees(extractResults(response));
    } catch (err) {
      console.error('Не удалось загрузить сотрудников', err);
      setEmployees([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (canAssign) loadEmployees();
  }, [canAssign]);

  useEffect(() => {
    const initialAssignee = searchParams.get('employee');
    if (initialAssignee && canAssign) {
      setAssigneeFilter(initialAssignee);
      setGoalFormData((prev) => ({ ...prev, employee: initialAssignee }));
      setShowGoalForm(true);
    }
  }, [canAssign, searchParams]);

  useEffect(() => () => {
    Object.values(pendingTimersRef.current).forEach((timerId) => clearTimeout(timerId));
    pendingTimersRef.current = {};
  }, []);

  useEffect(() => {
    if (pendingTaskIds.length === 0) {
      return;
    }

    const existingIds = new Set();
    goals.forEach((goalItem) => {
      (goalItem.tasks || []).forEach((taskItem) => existingIds.add(taskItem.id));
    });

    const hasMissing = pendingTaskIds.some((taskId) => !existingIds.has(taskId));
    if (hasMissing) {
      setPendingTaskIds((prev) => prev.filter((taskId) => existingIds.has(taskId)));
    }
  }, [goals, pendingTaskIds]);

  const filteredGoals = useMemo(() => {
    return goals.filter((goal) => {
      const matchesType = filterType === 'all' || goal.goal_type === filterType;
      const matchesEmployee = assigneeFilter === 'all' || String(goal.employee) === String(assigneeFilter);
      const matchesSearch =
        goal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        goal.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesEmployee && matchesSearch;
    });
  }, [goals, filterType, searchTerm, assigneeFilter]);

  const pendingTaskSet = useMemo(() => new Set(pendingTaskIds), [pendingTaskIds]);

  const handleGoalFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setGoalFormData((prev) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleGoalSubmit = async (event) => {
    event.preventDefault();
    setGoalFormError('');

    if (goalFormData.start_date && goalFormData.end_date && goalFormData.end_date < goalFormData.start_date) {
      setGoalFormError('Дата окончания должна быть позже даты начала.');
      return;
    }

    setSavingGoal(true);

    try {
      const payload = { ...goalFormData };
      if (!canAssign || !payload.employee) {
        delete payload.employee;
      } else {
        payload.employee = Number(payload.employee);
      }
      if (!payload.task_link) delete payload.task_link;

      await createGoal(payload);
      setShowGoalForm(false);
      setGoalFormData({
        ...initialGoalForm,
        employee: canAssign && assigneeFilter !== 'all' ? assigneeFilter : '',
      });
      await loadData();
    } catch (err) {
      console.error('Не удалось создать цель', err);
      const message =
        err.response?.data?.employee?.[0] ||
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Не удалось создать цель. Проверьте данные и попробуйте ещё раз.';
      setGoalFormError(message);
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDeleteGoal = async (id) => {
    const confirmed = window.confirm('Удалить цель и все связанные задачи?');
    if (!confirmed) return;

    try {
      await deleteGoal(id);
      await loadData();
    } catch (err) {
      console.error('Не удалось удалить цель', err);
      setError('Удаление не удалось. Попробуйте позже.');
    }
  };

  const toggleGoalExpand = (goalId) => {
    setExpandedGoals((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(goalId)) {
        newSet.delete(goalId);
      } else {
        newSet.add(goalId);
      }
      return newSet;
    });
  };

  const handleTaskToggle = async (goal, task) => {
    const nextStatus = !task.is_completed;
    const wasPending = pendingTaskIds.includes(task.id);

    clearPendingTimer(task.id);

    updateGoalTaskState(goal.id, task.id, { is_completed: nextStatus });

    if (nextStatus) {
      addPendingTask(task.id);
    } else {
      removePendingTask(task.id);
    }

    try {
      await updateTask(task.id, {
        goal: goal.id,
        title: task.title,
        description: task.description,
        is_completed: nextStatus,
      });

      if (nextStatus) {
        const timerId = setTimeout(() => {
          removePendingTask(task.id);
          delete pendingTimersRef.current[task.id];
          loadData({ showLoader: false });
        }, 3000);
        pendingTimersRef.current[task.id] = timerId;
      } else {
        await loadData({ showLoader: false });
      }
    } catch (err) {
      console.error('Не удалось обновить задачу', err);
      setError('Обновление задачи не удалось.');

      updateGoalTaskState(goal.id, task.id, { is_completed: !nextStatus });

      if (nextStatus) {
        removePendingTask(task.id);
        delete pendingTimersRef.current[task.id];
      } else if (wasPending) {
        addPendingTask(task.id);
        const timerId = setTimeout(() => {
          removePendingTask(task.id);
          delete pendingTimersRef.current[task.id];
          loadData({ showLoader: false });
        }, 3000);
        pendingTimersRef.current[task.id] = timerId;
      }

      await loadData({ showLoader: false });
    }
  };

  const handleAddTask = (goalId) => {
    setShowTaskForm(goalId);
    setEditingTask(null);
    setTaskFormData(initialTaskForm);
  };

  const handleEditTask = (goal, task) => {
    setShowTaskForm(goal.id);
    setEditingTask(task.id);
    setTaskFormData({
      title: task.title,
      description: task.description,
    });
  };

  const handleTaskFormChange = (event) => {
    const { name, value } = event.target;
    setTaskFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTaskSubmit = async (event, goalId) => {
    event.preventDefault();

    try {
      if (editingTask) {
        await updateTask(editingTask, {
          ...taskFormData,
          goal: goalId,
        });
      } else {
        await createTask({
          ...taskFormData,
          goal: goalId,
          is_completed: false,
        });
      }
      
      setShowTaskForm(null);
      setEditingTask(null);
      setTaskFormData(initialTaskForm);
      await loadData();
    } catch (err) {
      console.error('Не удалось сохранить задачу', err);
      setError('Сохранение задачи не удалось.');
    }
  };

  const handleDeleteTask = async (taskId) => {
    const confirmed = window.confirm('Удалить задачу?');
    if (!confirmed) return;

    try {
      await deleteTask(taskId);
      await loadData();
    } catch (err) {
      console.error('Не удалось удалить задачу', err);
      setError('Удаление задачи не удалось.');
    }
  };

  const checkCanCompleteGoal = (goal) => {
    const tasks = goal.tasks || [];
    const allCompleted = tasks.every(t => t.is_completed);
    return tasks.length > 0 && allCompleted && !goal.is_completed;
  };

  const handleCompleteGoalClick = (goal) => {
    setCompletingGoal(goal.id);
    setCompleteModalData({
      goalId: goal.id,
      title: goal.title,
      creatorType: goal.creator_type,
      requiresEvaluation: goal.requires_evaluation,
      departmentName: goal.department_name || employee?.department_name,
      launchEvaluation: goal.creator_type === 'manager' ? goal.requires_evaluation : false,
    });
  };

  const handleCompleteGoalConfirm = async () => {
    if (!completeModalData) return;

    try {
      await completeGoal(completeModalData.goalId, {
        launch_evaluation: completeModalData.launchEvaluation,
      });
      setCompleteModalData(null);
      setCompletingGoal(null);
      await loadData();
    } catch (err) {
      console.error('Не удалось завершить цель', err);
      const message = err.response?.data?.error || 'Не удалось завершить цель.';
      setError(message);
    }
  };

  const goalTypeLabel = (type) => {
    switch (type) {
      case 'strategic': return 'Стратегическая цель';
      case 'personal': return 'Личное развитие';
      default: return 'Тактическая задача';
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Цели и задачи</h1>
          <p className="page-subtitle">
            Управляйте целями и отслеживайте прогресс по задачам
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
          {canAssign && (
            <div className="input-with-icon select">
              <FiUsers size={16} />
              <select
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
              >
                <option value="all">Все сотрудники</option>
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name || item.username}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="button" className="btn primary" onClick={() => setShowGoalForm((prev) => !prev)}>
            <FiPlus size={16} /> {showGoalForm ? 'Скрыть форму' : 'Новая цель'}
          </button>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      {showGoalForm && (
        <section className="panel">
          <header className="panel-header">
            <h2>Создать цель</h2>
            <span>Определите параметры новой цели</span>
          </header>
          <form className="form-grid" onSubmit={handleGoalSubmit}>
            {canAssign && (
              <label className="form-field">
                <span>Сотрудник *</span>
                <select
                  name="employee"
                  value={goalFormData.employee}
                  onChange={handleGoalFormChange}
                  required
                  disabled={savingGoal}
                >
                  <option value="">Выберите сотрудника</option>
                  {employees.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.full_name || item.username}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="form-field">
              <span>Название *</span>
              <input
                type="text"
                name="title"
                value={goalFormData.title}
                onChange={handleGoalFormChange}
                placeholder="Например, Запуск новой версии портала"
                required
              />
            </label>
            <label className="form-field span-2">
              <span>Описание *</span>
              <textarea
                name="description"
                value={goalFormData.description}
                onChange={handleGoalFormChange}
                rows={4}
                placeholder="Опишите ключевые параметры и ожидаемый результат"
                required
              />
            </label>
            <label className="form-field">
              <span>Тип цели *</span>
              <select name="goal_type" value={goalFormData.goal_type} onChange={handleGoalFormChange} required>
                <option value="strategic">Стратегическая</option>
                <option value="tactical">Тактическая</option>
                <option value="personal">Личное развитие</option>
              </select>
            </label>
            <label className="form-field">
              <span>Дата начала *</span>
              <input
                type="date"
                name="start_date"
                value={goalFormData.start_date}
                onChange={handleGoalFormChange}
                required
              />
            </label>
            <label className="form-field">
              <span>Дата завершения *</span>
              <input
                type="date"
                name="end_date"
                value={goalFormData.end_date}
                onChange={handleGoalFormChange}
                required
              />
            </label>
            <label className="form-field span-2">
              <span>Ожидаемый результат *</span>
              <textarea
                name="expected_results"
                value={goalFormData.expected_results}
                onChange={handleGoalFormChange}
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
                value={goalFormData.task_link}
                onChange={handleGoalFormChange}
                placeholder="https://..."
              />
            </label>
            
            {canAssign && goalFormData.employee && goalFormData.employee !== String(employee?.id) && (
              <label className="form-field checkbox span-2">
                <input
                  type="checkbox"
                  name="requires_evaluation"
                  checked={goalFormData.requires_evaluation}
                  onChange={handleGoalFormChange}
                />
                <span>Обязательная оценка после выполнения</span>
              </label>
            )}

            {goalFormError && <div className="form-hint error span-2">{goalFormError}</div>}

            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setShowGoalForm(false)}>
                Отменить
              </button>
              <button type="submit" className="btn primary" disabled={savingGoal}>
                {savingGoal ? 'Сохраняем…' : 'Создать цель'}
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
            <button type="button" className="btn ghost" onClick={() => setShowGoalForm(true)}>
              Создать новую цель
            </button>
          </div>
        ) : (
          <div className="goals-list">
            {filteredGoals.map((goal) => {
              const tasks = goal.tasks || [];
              const completedCount = tasks.filter((task) => task.is_completed).length;
              const visibleTasks = tasks.filter((task) => !task.is_completed || pendingTaskSet.has(task.id));
              const completedTasksTail = tasks.filter(
                (task) => task.is_completed && !pendingTaskSet.has(task.id)
              );
              const allTasksOrdered = [...visibleTasks, ...completedTasksTail];
              
              const daysUntil = getDaysUntilDeadline(goal.end_date);
              const isUrgent = daysUntil !== null && daysUntil < 7;
              const isExpanded = expandedGoals.has(goal.id);
              const canComplete = checkCanCompleteGoal(goal);

              return (
                <article key={goal.id} className={`goal-item ${goal.is_completed ? 'completed' : ''}`}>
                  <header className="goal-header">
                    <button
                      type="button"
                      className="expand-btn"
                      onClick={() => toggleGoalExpand(goal.id)}
                    >
                      {isExpanded ? <FiChevronDown size={20} /> : <FiChevronRight size={20} />}
                    </button>
                    <div className="goal-info">
                      <h3>{goal.title}</h3>
                      <div className="goal-meta">
                        <span className={`badge ${goal.goal_type}`}>{goalTypeLabel(goal.goal_type)}</span>
                        {canAssign && goal.employee_name && (
                          <span className="meta-text">{goal.employee_name}</span>
                        )}
                        <span className="meta-text">
                          Создал: {goal.creator_type === 'manager' ? 'Руководитель' : 'Сотрудник'}
                        </span>
                        <span className={`meta-text ${goal.requires_evaluation ? 'highlight' : ''}`}>
                          Обязательная оценка: {goal.requires_evaluation ? 'Да' : 'Нет'}
                        </span>
                      </div>
                    </div>
                    <div className="goal-dates">
                      <div className="date-item">
                        <FiCalendar size={14} />
                        <span>{formatDateRU(goal.start_date)}</span>
                      </div>
                      <div className={`date-item ${isUrgent ? 'urgent' : ''}`}>
                        <FiCalendar size={14} />
                        <span>
                          {formatDateRU(goal.end_date)}
                          {isUrgent && daysUntil >= 0 && ` (${daysUntil} дн.)`}
                          {daysUntil < 0 && ' (просрочено)'}
                        </span>
                      </div>
                    </div>
                    <div className="goal-progress">
                      <span>{completedCount}/{tasks.length}</span>
                    </div>
                    <button type="button" className="icon-btn" onClick={() => handleDeleteGoal(goal.id)}>
                      <FiTrash2 size={16} />
                    </button>
                  </header>

                  {isExpanded && (
                    <div className="goal-content">
                      <div className="goal-description">
                        <h4>Описание</h4>
                        <p>{goal.description}</p>
                      </div>
                      
                      <div className="goal-description">
                        <h4>Ожидаемый результат</h4>
                        <p>{goal.expected_results}</p>
                      </div>

                      {goal.task_link && (
                        <div className="goal-link">
                          <a href={goal.task_link} target="_blank" rel="noopener noreferrer">
                            <FiExternalLink size={14} /> Материалы
                          </a>
                        </div>
                      )}

                      <div className="tasks-section">
                        <div className="tasks-header">
                          <h4>Задачи ({tasks.length})</h4>
                          {!goal.is_completed && (
                            <button
                              type="button"
                              className="btn ghost small"
                              onClick={() => handleAddTask(goal.id)}
                            >
                              <FiPlus size={14} /> Добавить задачу
                            </button>
                          )}
                        </div>

                        {showTaskForm === goal.id && (
                          <form className="task-form" onSubmit={(e) => handleTaskSubmit(e, goal.id)}>
                            <input
                              type="text"
                              name="title"
                              value={taskFormData.title}
                              onChange={handleTaskFormChange}
                              placeholder="Название задачи"
                              required
                            />
                            <textarea
                              name="description"
                              value={taskFormData.description}
                              onChange={handleTaskFormChange}
                              placeholder="Описание задачи"
                              rows={2}
                              required
                            />
                            <div className="task-form-actions">
                              <button type="button" className="btn ghost small" onClick={() => setShowTaskForm(null)}>
                                Отмена
                              </button>
                              <button type="submit" className="btn primary small">
                                {editingTask ? 'Сохранить' : 'Добавить'}
                              </button>
                            </div>
                          </form>
                        )}

                        <ul className="tasks-list">
                          {allTasksOrdered.length === 0 && (
                            <li className="empty-tasks">Задач пока нет. Добавьте первую задачу.</li>
                          )}
                          {allTasksOrdered.map((task) => {
                            const isPendingCompletion = pendingTaskSet.has(task.id);
                            const taskClasses = [
                              'task-item',
                              task.is_completed ? 'completed' : '',
                              isPendingCompletion ? 'pending' : '',
                            ]
                              .filter(Boolean)
                              .join(' ');
                            return (
                              <li key={task.id} className={taskClasses}>
                              <button
                                type="button"
                                className="task-checkbox"
                                onClick={() => handleTaskToggle(goal, task)}
                                disabled={goal.is_completed}
                              >
                                {task.is_completed ? (
                                  <FiCheckCircle size={18} />
                                ) : (
                                  <FiCircle size={18} />
                                )}
                              </button>
                              <div className="task-content">
                                <strong>{task.title}</strong>
                                <span>{task.description}</span>
                              </div>
                              {!goal.is_completed && (
                                <div className="task-actions">
                                  <button
                                    type="button"
                                    className="icon-btn small"
                                    onClick={() => handleEditTask(goal, task)}
                                  >
                                    <FiEdit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-btn small"
                                    onClick={() => handleDeleteTask(task.id)}
                                  >
                                    <FiTrash2 size={14} />
                                  </button>
                                </div>
                              )}
                              </li>
                            );
                          })}
                        </ul>

                        {canComplete && (
                          <button
                            type="button"
                            className="btn success"
                            onClick={() => handleCompleteGoalClick(goal)}
                          >
                            Завершить цель
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {completeModalData && (
        <div className="modal-overlay" onClick={() => setCompleteModalData(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Завершить цель</h2>
            </header>
            <div className="modal-body">
              <p><strong>{completeModalData.title}</strong></p>
              <p>Хотите завершить цель? Перед завершением проверьте, все ли задачи действительно выполнены.</p>
              
              {completeModalData.creatorType === 'manager' && completeModalData.requiresEvaluation && (
                <div className="info-block">
                  <p>
                    После нажатия на кнопку, сотрудникам отдела <strong>{completeModalData.departmentName}</strong> будет
                    автоматически предложено оценить выполнение цели.
                  </p>
                </div>
              )}

              {completeModalData.creatorType === 'self' && (
                <label className="form-field checkbox">
                  <input
                    type="checkbox"
                    checked={completeModalData.launchEvaluation}
                    onChange={(e) =>
                      setCompleteModalData((prev) => ({
                        ...prev,
                        launchEvaluation: e.target.checked,
                      }))
                    }
                  />
                  <span>Запустить оценку цели коллегами</span>
                </label>
              )}
            </div>
            <footer className="modal-footer">
              <button type="button" className="btn ghost" onClick={() => setCompleteModalData(null)}>
                Отмена
              </button>
              <button type="button" className="btn success" onClick={handleCompleteGoalConfirm}>
                Завершить цель
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoalsAndTasks;
