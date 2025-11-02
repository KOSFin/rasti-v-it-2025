import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  FiPlus, FiSearch, FiFilter, FiTrash2, FiCalendar, FiExternalLink, 
  FiUsers, FiChevronDown, FiChevronRight, FiCheckCircle, FiCircle, FiEdit2
} from 'react-icons/fi';
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  completeGoal,
  createTask,
  updateTask,
  deleteTask,
  getEmployees,
  getPendingSelfAssessments,
  createSelfAssessment,
} from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import './Common.css';
import './GoalsAndTasks.css';
import SelfAssessmentModal from './SelfAssessmentModal';

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
  participants: [],
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
  const [pendingSelfGoals, setPendingSelfGoals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalFormData, setGoalFormData] = useState(initialGoalForm);
  const [goalFormError, setGoalFormError] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');

  const [expandedGoals, setExpandedGoals] = useState(new Set());
  const [editingTask, setEditingTask] = useState(null);
  const [taskFormData, setTaskFormData] = useState(initialTaskForm);
  const [showTaskForm, setShowTaskForm] = useState(null); // goalId

  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  const [completeModalData, setCompleteModalData] = useState(null);
  const [pendingTaskIds, setPendingTaskIds] = useState([]);
  const pendingTimersRef = useRef({});

  const [selfAssessmentGoal, setSelfAssessmentGoal] = useState(null);
  const [selfAssessmentError, setSelfAssessmentError] = useState('');
  const [selfAssessmentSaving, setSelfAssessmentSaving] = useState(false);
  const [autoLaunchHandled, setAutoLaunchHandled] = useState(false);

  const isManager = Boolean(employee?.is_manager);
  const isAdmin = Boolean(user?.is_superuser);
  const canAssign = isAdmin || isManager;

  // Мемоизированные значения для участников цели
  const employeesLookup = useMemo(() => {
    return employees.reduce((acc, item) => {
      acc[String(item.id)] = item;
      return acc;
    }, {});
  }, [employees]);

  const normalizedParticipants = useMemo(
    () => goalFormData.participants.map((item) => String(item)).filter(Boolean),
    [goalFormData.participants]
  );

  const selectedParticipants = useMemo(() => {
    return normalizedParticipants.map((participantId) => {
      const employeeData = employeesLookup[participantId];
      if (employeeData) {
        return employeeData;
      }
      return {
        id: participantId,
        full_name: `Сотрудник #${participantId}`,
        username: `user-${participantId}`,
        position_name: '',
        position_title: '',
        department_name: '',
      };
    });
  }, [normalizedParticipants, employeesLookup]);

  const ownerParticipantId = useMemo(
    () => normalizedParticipants[0] || '',
    [normalizedParticipants]
  );

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
      const [goalsRes, pendingAssessmentsRes] = await Promise.all([
        getGoals({ page_size: 200, ordering: '-created_at' }),
        getPendingSelfAssessments(),
      ]);

      setGoals(extractResults(goalsRes));
      setPendingSelfGoals(extractResults(pendingAssessmentsRes));
    } catch (err) {
      console.error('Не удалось загрузить цели', err);
      setError('Не удалось загрузить цели. Попробуйте обновить страницу.');
      setPendingSelfGoals([]);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const loadEmployees = async () => {
    if (!canAssign) return;

    const params = { page_size: 300, ordering: 'user__last_name' };
    // Фильтр по отделу применяется только для менеджеров, НЕ для админов
    if (isManager && !isAdmin && employee?.department) {
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
    if (!showGoalForm) {
      setParticipantSearch('');
    }
  }, [showGoalForm]);

  useEffect(() => {
    if (
      canAssign &&
      ownerParticipantId &&
      employee?.id &&
      ownerParticipantId === String(employee.id) &&
      goalFormData.requires_evaluation
    ) {
      setGoalFormData((prev) => ({
        ...prev,
        requires_evaluation: false,
      }));
    }
  }, [canAssign, ownerParticipantId, employee?.id, goalFormData.requires_evaluation]);

  useEffect(() => {
    const initialAssignee = searchParams.get('employee');
    if (initialAssignee && canAssign) {
      setAssigneeFilter(initialAssignee);
      setGoalFormData((prev) => ({ ...prev, participants: [initialAssignee] }));
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

  const resolveGoalForSelfAssessment = useCallback(
    (goalRef) => {
      const numericId = Number(
        typeof goalRef === 'object' && goalRef ? goalRef.id : goalRef
      );

      if (Number.isNaN(numericId)) {
        return null;
      }

      return (
        goals.find((item) => Number(item.id) === numericId) ||
        pendingSelfGoals.find((item) => Number(item.id) === numericId) ||
        null
      );
    },
    [goals, pendingSelfGoals]
  );

  const openSelfAssessment = useCallback(
    (goalRef) => {
      const target =
        typeof goalRef === 'object' && goalRef
          ? goalRef
          : resolveGoalForSelfAssessment(goalRef);

      if (!target) {
        return;
      }

      setSelfAssessmentGoal(target);
      setSelfAssessmentError('');
      setAutoLaunchHandled(true);
    },
    [resolveGoalForSelfAssessment]
  );

  useEffect(() => {
    if (pendingSelfGoals.length === 0) {
      setAutoLaunchHandled(false);
    }
  }, [pendingSelfGoals.length]);

  useEffect(() => {
    if (loading || selfAssessmentGoal) {
      return;
    }

    const paramGoalId = searchParams.get('self_assessment_goal');
    if (paramGoalId) {
      const target = resolveGoalForSelfAssessment(paramGoalId);
      if (target) {
        openSelfAssessment(target);
        return;
      }
    }

    if (!autoLaunchHandled && pendingSelfGoals.length > 0) {
      const target = resolveGoalForSelfAssessment(pendingSelfGoals[0]);
      if (target) {
        openSelfAssessment(target);
      }
    }
  }, [
    loading,
    selfAssessmentGoal,
    searchParams,
    resolveGoalForSelfAssessment,
    openSelfAssessment,
    pendingSelfGoals,
    autoLaunchHandled,
  ]);

  const pendingSelfGoalIds = useMemo(
    () => new Set(pendingSelfGoals.map((goal) => goal.id)),
    [pendingSelfGoals]
  );

  const filteredGoals = useMemo(() => {
    return goals.filter((goal) => {
      const matchesType = filterType === 'all' || goal.goal_type === filterType;
      const participantsList = Array.isArray(goal.participants_info) ? goal.participants_info : [];
      const matchesEmployee =
        assigneeFilter === 'all' ||
        String(goal.employee) === String(assigneeFilter) ||
        participantsList.some(
          (participant) => String(participant.employee) === String(assigneeFilter)
        );
      const matchesSearch =
        goal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        goal.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesEmployee && matchesSearch;
    });
  }, [goals, filterType, searchTerm, assigneeFilter]);

  const participantCandidates = useMemo(() => {
    if (!canAssign) {
      return [];
    }

    const query = participantSearch.trim().toLowerCase();
    return employees
      .filter((employeeItem) => !normalizedParticipants.includes(String(employeeItem.id)))
      .filter((employeeItem) => {
        if (!query) {
          return true;
        }
        const name = (employeeItem.full_name || employeeItem.username || '').toLowerCase();
        const position = (employeeItem.position_name || employeeItem.position_title || '').toLowerCase();
        const department = (employeeItem.department_name || '').toLowerCase();
        return [name, position, department].some((value) => value.includes(query));
      })
      .slice(0, 15);
  }, [canAssign, employees, normalizedParticipants, participantSearch]);

  const pendingTaskSet = useMemo(() => new Set(pendingTaskIds), [pendingTaskIds]);

  const categorizedGoals = useMemo(() => {
    const buckets = {
      active: [],
      awaiting: [],
      completed: [],
    };

    filteredGoals.forEach((goal) => {
      const awaitingEvaluation =
        goal.is_completed &&
        (goal.evaluation_launched || pendingSelfGoalIds.has(goal.id)) &&
        ((goal.evaluations_pending ?? 0) > 0 || pendingSelfGoalIds.has(goal.id));

      // Determine if current user is participant/owner of the goal
      const participantsList = Array.isArray(goal.participants_info) ? goal.participants_info : [];
      const isParticipant =
        Number(goal.employee) === Number(employee?.id) ||
        participantsList.some((p) => Number(p.employee) === Number(employee?.id));

      if (!goal.is_completed) {
        buckets.active.push(goal);
      } else if (awaitingEvaluation && isParticipant) {
        // Only show awaiting-evaluation goals that the current user is actually
        // a participant of (owner or listed in participants_info). Other users
        // (who may have evaluation notifications) will see those goals on the
        // 360° page instead.
        buckets.awaiting.push(goal);
      } else {
        buckets.completed.push(goal);
      }
    });

    return buckets;
  }, [filteredGoals, pendingSelfGoalIds]);

  const handleAddParticipant = (participantId) => {
    if (savingGoal) {
      return;
    }
    const key = String(participantId);
    setGoalFormData((prev) => {
      const existing = prev.participants.map((item) => String(item));
      if (existing.includes(key)) {
        return prev;
      }
      return {
        ...prev,
        participants: [...existing, key],
      };
    });
    setGoalFormError('');
  };

  const handleRemoveParticipant = (participantId) => {
    if (savingGoal) {
      return;
    }
    const key = String(participantId);
    setGoalFormData((prev) => ({
      ...prev,
      participants: prev.participants.filter((item) => String(item) !== key),
    }));
  };

  const handlePromoteParticipant = (participantId) => {
    if (savingGoal) {
      return;
    }
    const key = String(participantId);
    setGoalFormData((prev) => {
      const remaining = prev.participants.filter((item) => String(item) !== key);
      return {
        ...prev,
        participants: [key, ...remaining],
      };
    });
  };

  const handleGoalFormChange = (event) => {
    const { name, value, type, checked } = event.target;

    setGoalFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
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
      const participantIds = normalizedParticipants
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id) && id > 0);

      if (canAssign) {
        if (participantIds.length === 0) {
          setGoalFormError('Выберите хотя бы одного участника цели.');
          setSavingGoal(false);
          return;
        }
        payload.participant_ids = participantIds;
      }

      delete payload.participants;
      if (!payload.task_link) delete payload.task_link;

      await createGoal(payload);
      setShowGoalForm(false);
      setGoalFormData({
        ...initialGoalForm,
        participants:
          canAssign && assigneeFilter !== 'all' ? [assigneeFilter] : [],
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
      const response = await completeGoal(completeModalData.goalId, {
        launch_evaluation: completeModalData.launchEvaluation,
      });
      const updatedGoal = response?.data;

      setCompleteModalData(null);

      if (
        updatedGoal &&
        updatedGoal.evaluation_launched &&
        Number(updatedGoal.employee) === Number(employee?.id)
      ) {
        openSelfAssessment(updatedGoal);
      }

      await loadData({ showLoader: false });
    } catch (err) {
      console.error('Не удалось завершить цель', err);
      const message = err.response?.data?.error || 'Не удалось завершить цель.';
      setError(message);
    }
  };

  const handleSelfAssessmentSubmit = async (formValues) => {
    if (!selfAssessmentGoal) {
      return;
    }

    setSelfAssessmentSaving(true);
    setSelfAssessmentError('');

    try {
      await createSelfAssessment({
        ...formValues,
        goal: selfAssessmentGoal.id,
        collaboration_quality: Number(formValues.collaboration_quality ?? 0),
        satisfaction_score: Number(formValues.satisfaction_score ?? 0),
      });

      setSelfAssessmentGoal(null);
      setAutoLaunchHandled(false);
      await loadData({ showLoader: false });
    } catch (err) {
      console.error('Не удалось сохранить самооценку', err);
      const message =
        err.response?.data?.achieved_results?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Не удалось сохранить самооценку. Попробуйте снова.';
      setSelfAssessmentError(message);
    } finally {
      setSelfAssessmentSaving(false);
    }
  };

  const handleCloseSelfAssessment = () => {
    setSelfAssessmentGoal(null);
    setSelfAssessmentError('');
  };

  const renderSection = (title, items, emptyMessage) => (
    <div className="category-section" key={title}>
      <div className="category-header">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="category-empty">{emptyMessage}</div>
      ) : (
        <div className="goals-list">{items.map((item) => renderGoalCard(item))}</div>
      )}
    </div>
  );

  const renderGoalCard = (goal) => {
    const tasks = goal.tasks || [];
    const completedCount = tasks.filter((task) => task.is_completed).length;
    const visibleTasks = tasks.filter((task) => !task.is_completed || pendingTaskSet.has(task.id));
    const completedTasksTail = tasks.filter((task) => task.is_completed && !pendingTaskSet.has(task.id));
    const allTasksOrdered = [...visibleTasks, ...completedTasksTail];
    const participantsInfo = Array.isArray(goal.participants_info) ? goal.participants_info : [];
    const orderedParticipants = participantsInfo
      .slice()
      .sort((first, second) => {
        if (first.is_owner === second.is_owner) {
          return 0;
        }
        return first.is_owner ? -1 : 1;
      });
    const ownerParticipant = orderedParticipants.find((participant) => participant.is_owner);

    const daysUntil = getDaysUntilDeadline(goal.end_date);
    const isUrgent = daysUntil !== null && daysUntil < 7;
    const isExpanded = expandedGoals.has(goal.id);
    const canComplete = checkCanCompleteGoal(goal);
    const isOwner = Number(goal.employee) === Number(employee?.id);
    const awaitingEvaluation =
      goal.is_completed &&
      (goal.evaluation_launched || pendingSelfGoalIds.has(goal.id)) &&
      ((goal.evaluations_pending ?? 0) > 0 || pendingSelfGoalIds.has(goal.id));
    const needsSelfAssessment = isOwner && pendingSelfGoalIds.has(goal.id);

    const goalClasses = ['goal-item'];
    if (goal.is_completed) {
      goalClasses.push('completed');
    }
    if (awaitingEvaluation) {
      goalClasses.push('awaiting');
    }

    const evaluationMeta = awaitingEvaluation
      ? needsSelfAssessment
        ? 'Самооценка ожидает'
        : `Коллег ждут: ${goal.evaluations_pending ?? 0}`
      : null;

    return (
      <article key={goal.id} className={goalClasses.join(' ')}>
        <header
          className="goal-header"
          onClick={(e) => {
            // If the click originated from a button, link or an element with .icon-btn or .chip-action,
            // do not toggle expansion (allow the element's handler to run).
            const el = e.target;
            if (
              el.closest('button') ||
              el.closest('a') ||
              el.closest('.icon-btn') ||
              el.closest('.chip-action') ||
              el.closest('.task-checkbox')
            ) {
              return;
            }
            toggleGoalExpand(goal.id);
          }}
        >
          <button
            type="button"
            className="expand-btn"
            onClick={(ev) => {
              ev.stopPropagation();
              toggleGoalExpand(goal.id);
            }}
          >
            {isExpanded ? <FiChevronDown size={20} /> : <FiChevronRight size={20} />}
          </button>
          <div className="goal-info">
            <h3>{goal.title}</h3>
            <div className="goal-meta">
              <span className={`badge ${goal.goal_type}`}>{goalTypeLabel(goal.goal_type)}</span>
              {ownerParticipant && (
                <span className="meta-text">
                  Владелец: {ownerParticipant.employee_name}
                </span>
              )}
              <span className="meta-text">
                Создал: {goal.creator_type === 'manager' ? 'Руководитель' : 'Сотрудник'}
              </span>
              <span className={`meta-text ${goal.requires_evaluation ? 'highlight' : ''}`}>
                Обязательная оценка: {goal.requires_evaluation ? 'Да' : 'Нет'}
              </span>
              {evaluationMeta && <span className="meta-text highlight">{evaluationMeta}</span>}
            </div>
            {orderedParticipants.length > 0 && (
              <div className="goal-participants">
                {orderedParticipants.map((participant) => {
                  const isSelfParticipant = Number(participant.employee) === Number(employee?.id);
                  const chipClasses = ['participant-chip'];
                  if (participant.is_owner) chipClasses.push('owner');
                  if (isSelfParticipant) chipClasses.push('self');
                  return (
                    <span key={participant.id} className={chipClasses.join(' ')}>
                      {participant.employee_name}
                      {participant.position_name ? ` • ${participant.position_name}` : ''}
                    </span>
                  );
                })}
              </div>
            )}
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

            {needsSelfAssessment && (
              <div className="self-assessment-callout">
                <p>По этой цели нужно заполнить самооценку. Это займёт пару минут.</p>
                <button
                  type="button"
                  className="btn primary small"
                  onClick={() => openSelfAssessment(goal)}
                >
                  Заполнить
                </button>
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
                        {task.is_completed ? <FiCheckCircle size={18} /> : <FiCircle size={18} />}
                      </button>
                      <div className="task-content">
                        <strong>{task.title}</strong>
                        <span>{task.description}</span>
                        {task.is_completed && task.completed_by_name && (
                          <span className="task-meta">Выполнил: {task.completed_by_name}</span>
                        )}
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
              <label className="form-field span-2">
                <span>Участники цели *</span>
                <div className="participant-picker">
                  <div className="selected-participants">
                    {selectedParticipants.length === 0 ? (
                      <div className="picker-empty">
                        <p>Пока никого не выбрали.</p>
                        {employee && (
                          <button
                            type="button"
                            className="btn inline"
                            onClick={() => handleAddParticipant(employee.id)}
                            disabled={savingGoal}
                          >
                            Добавить себя
                          </button>
                        )}
                      </div>
                    ) : (
                      selectedParticipants.map((participant, index) => (
                        <div
                          key={participant.id}
                          className={`selected-chip ${index === 0 ? 'owner' : ''}`}
                        >
                          <div className="chip-main">
                            <strong>{participant.full_name || participant.username}</strong>
                            {index === 0 && <span className="chip-owner-tag">Владелец цели</span>}
                            <span>
                              {participant.position_name || participant.position_title || '—'}
                              {participant.department_name ? ` • ${participant.department_name}` : ''}
                            </span>
                          </div>
                          <div className="chip-actions">
                            {index > 0 && (
                              <button
                                type="button"
                                className="chip-action"
                                onClick={() => handlePromoteParticipant(participant.id)}
                                disabled={savingGoal}
                              >
                                Сделать владельцем
                              </button>
                            )}
                            <button
                              type="button"
                              className="chip-action danger"
                              onClick={() => handleRemoveParticipant(participant.id)}
                              disabled={savingGoal}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="participant-picker-controls">
                    <div className="input-with-icon compact">
                      <FiSearch size={14} />
                      <input
                        type="search"
                        placeholder="Найти сотрудника по имени, должности или отделу"
                        value={participantSearch}
                        onChange={(event) => setParticipantSearch(event.target.value)}
                        disabled={savingGoal}
                      />
                    </div>
                    <div className="participant-candidates">
                      {employees.length === 0 ? (
                        <div className="picker-empty muted">Нет сотрудников для выбора.</div>
                      ) : participantCandidates.length === 0 ? (
                        <div className="picker-empty muted">Совпадений не найдено.</div>
                      ) : (
                        participantCandidates.map((candidate) => (
                          <button
                            key={candidate.id}
                            type="button"
                            className="candidate-item"
                            onClick={() => handleAddParticipant(candidate.id)}
                            disabled={savingGoal}
                          >
                            <div className="candidate-info">
                              <strong>{candidate.full_name || candidate.username}</strong>
                              <span>
                                {candidate.position_name || candidate.position_title || '—'}
                                {candidate.department_name ? ` • ${candidate.department_name}` : ''}
                              </span>
                            </div>
                            <span className="candidate-action">Добавить</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <small className="form-hint">
                  Первый в списке — владелец цели. Используйте «Сделать владельцем», чтобы назначить ответственного.
                </small>
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

            {canAssign && ownerParticipantId && ownerParticipantId !== String(employee?.id) && (
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
          <>
            {renderSection('Активные цели', categorizedGoals.active, 'Активных целей нет. Создайте новую цель, чтобы начать.')}
            {renderSection('Ожидают оценки', categorizedGoals.awaiting, 'Сейчас нет целей, ожидающих оценок.')}
            {renderSection('Завершённые цели', categorizedGoals.completed, 'Завершённые цели появятся здесь после оценки.')}
          </>
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

      {selfAssessmentGoal && (
        <SelfAssessmentModal
          goal={selfAssessmentGoal}
          saving={selfAssessmentSaving}
          error={selfAssessmentError}
          onSubmit={handleSelfAssessmentSubmit}
          onClose={handleCloseSelfAssessment}
        />
      )}
    </div>
  );
}

export default GoalsAndTasks;
