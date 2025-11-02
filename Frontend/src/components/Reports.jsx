import { useEffect, useMemo, useState } from 'react';
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCheckCircle,
  FiCheckSquare,
  FiRefreshCw,
  FiTarget,
  FiUsers,
} from 'react-icons/fi';
import {
  getDepartments,
  getAllEmployees,
  getFinalReviews,
  getGoals,
  getManagerReviews,
  getPotentialAssessments,
  getTasks,
} from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import './Reports.css';

const extractResults = (response) => {
  if (!response?.data) {
    return [];
  }
  if (Array.isArray(response.data?.results)) {
    return response.data.results;
  }
  return Array.isArray(response.data) ? response.data : response.data?.results || [];
};

function Reports() {
  const { user, employee } = useAuth();
  const isAdmin = Boolean(user?.is_superuser);
  const isManager = Boolean(employee?.is_manager);

  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [members, setMembers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [potentialAssessments, setPotentialAssessments] = useState([]);
  const [managerReviews, setManagerReviews] = useState([]);
  const [finalReviews, setFinalReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAdmin) {
      getDepartments()
        .then((response) => setDepartments(extractResults(response)))
        .catch((err) => console.error('Не удалось загрузить отделы', err));
    }
  }, [isAdmin]);

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
      const [employeesList, goalsRes, tasksRes, potentialRes, reviewsRes, finalRes] = await Promise.all([
        getAllEmployees(params),
        getGoals({ page_size: 500, ordering: '-created_at' }),
        getTasks({ page_size: 1000 }),
        getPotentialAssessments({ page_size: 500 }),
        getManagerReviews({ page_size: 500 }),
        getFinalReviews({ page_size: 500 }),
      ]);

      setMembers(employeesList || []);
      setGoals(extractResults(goalsRes));
      setTasks(extractResults(tasksRes));
      setPotentialAssessments(extractResults(potentialRes));
      setManagerReviews(extractResults(reviewsRes));
      setFinalReviews(extractResults(finalRes));
    } catch (err) {
      console.error('Не удалось загрузить отчеты', err);
      setError('Не удалось загрузить аналитические данные. Попробуйте позже.');
      setMembers([]);
      setGoals([]);
      setTasks([]);
      setPotentialAssessments([]);
      setManagerReviews([]);
      setFinalReviews([]);
    } finally {
      setLoading(false);
    }
  };

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

  const metrics = useMemo(() => {
    const today = new Date();

    const activeGoals = goals.filter((goal) => goal.end_date && new Date(goal.end_date) >= today);
    const overdueGoals = goals.filter((goal) => goal.end_date && new Date(goal.end_date) < today);

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.is_completed).length;
    const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const successorCount = potentialAssessments.filter((item) => item.is_successor).length;
    const highRiskEmployees = potentialAssessments
      .filter((item) => item.retention_risk >= 7)
      .map((item) => ({
        id: item.employee,
        name: item.employee_name,
        risk: item.retention_risk,
      }));

    const averageReviewScore = finalReviews.length
      ? Math.round(
          (finalReviews.reduce((sum, review) => sum + (Number(review.total_score) || 0), 0) /
            finalReviews.length) *
            10
        ) / 10
      : 0;

    const reviewCoverage = members.length
      ? Math.round((finalReviews.length / members.length) * 100)
      : 0;

    const goalMetricsByEmployee = goals.reduce((acc, goal) => {
      if (!goal.employee) {
        return acc;
      }
      const current = acc[goal.employee] || {
        id: goal.employee,
        name: goal.employee_name,
        total: 0,
        overdue: 0,
      };
      current.total += 1;
      if (goal.end_date && new Date(goal.end_date) < today) {
        current.overdue += 1;
      }
      acc[goal.employee] = current;
      return acc;
    }, {});

    const taskMetricsByEmployee = tasks.reduce((acc, task) => {
      const goal = goalById[task.goal];
      if (!goal?.employee) {
        return acc;
      }
      const current = acc[goal.employee] || {
        id: goal.employee,
        name: goal.employee_name,
        total: 0,
        completed: 0,
      };
      current.total += 1;
      if (task.is_completed) {
        current.completed += 1;
      }
      acc[goal.employee] = current;
      return acc;
    }, {});

    const readinessLeaders = potentialAssessments
      .filter((item) => item.is_successor)
      .map((item) => ({
        id: item.employee,
        name: item.employee_name,
        readiness: item.successor_readiness,
      }));

    return {
      activeGoals: activeGoals.length,
      overdueGoals: overdueGoals.length,
      totalTasks,
      completedTasks,
      completionRate,
      successorCount,
      highRiskEmployees,
      averageReviewScore,
      reviewCoverage,
      goalMetricsByEmployee,
      taskMetricsByEmployee,
      readinessLeaders,
    };
  }, [goals, tasks, potentialAssessments, finalReviews, members.length, goalById]);

  const [selectedEmployeeReport, setSelectedEmployeeReport] = useState(null);

  const openEmployeeReport = (employeeId) => {
    const employee = members.find((m) => Number(m.id) === Number(employeeId));
    if (!employee) return;

    const empGoals = goals.filter((g) => String(g.employee) === String(employeeId));
    const empTasks = tasks.filter((t) => {
      const g = goalById[t.goal];
      return g && String(g.employee) === String(employeeId);
    });

    const completedGoals = empGoals.filter((g) => g.is_completed).length;
    const totalGoals = empGoals.length;
    const completedTasks = empTasks.filter((t) => t.is_completed).length;
    const totalTasksEmp = empTasks.length;

    const teamAvgGoals = Object.values(metrics.goalMetricsByEmployee).reduce((acc, it) => acc + it.total, 0) / Math.max(1, Object.values(metrics.goalMetricsByEmployee).length);
    const teamAvgCompletedTasks = Object.values(metrics.taskMetricsByEmployee).reduce((acc, it) => acc + (it.completed || 0), 0) / Math.max(1, Object.values(metrics.taskMetricsByEmployee).length);

    setSelectedEmployeeReport({
      employee,
      empGoals,
      empTasks,
      completedGoals,
      totalGoals,
      completedTasks,
      totalTasksEmp,
      teamAvgGoals,
      teamAvgCompletedTasks,
    });
  };

  const closeEmployeeReport = () => setSelectedEmployeeReport(null);

  if (!isAdmin && !isManager) {
    return null;
  }

  return (
    <div className="page reports-page">
      <header className="page-header">
        <div>
          <p className="page-overline">
            <FiBarChart2 size={14} /> Аналитика по оценкам
          </p>
          <h1>Отчеты по команде</h1>
          <p className="page-subtitle">
            Отслеживайте прогресс целей, качество выполнения задач и готовность сотрудников к развитию
          </p>
        </div>
        <div className="page-actions">
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
          <FiTarget size={20} />
          <div>
            <p className="label">Активные цели</p>
            <p className="value">{metrics.activeGoals}</p>
          </div>
        </article>
        <article className="summary-card warning">
          <FiAlertTriangle size={20} />
          <div>
            <p className="label">Просрочено целей</p>
            <p className="value">{metrics.overdueGoals}</p>
          </div>
        </article>
        <article className="summary-card">
          <FiCheckSquare size={20} />
          <div>
            <p className="label">Задач выполнено</p>
            <p className="value">{metrics.completedTasks}</p>
            <span className="hint">Прогресс: {metrics.completionRate}%</span>
          </div>
        </article>
        <article className="summary-card">
          <FiCheckCircle size={20} />
          <div>
            <p className="label">Средний итоговый балл</p>
            <p className="value">{metrics.averageReviewScore}</p>
            <span className="hint">Покрытие отзывами: {metrics.reviewCoverage}%</span>
          </div>
        </article>
      </section>
      {selectedEmployeeReport && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeEmployeeReport}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Статистика: {selectedEmployeeReport.employee.full_name || selectedEmployeeReport.employee.username}</h3>
            </header>
            <div className="modal-body">
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
                <div className="card">
                  <h4>Цели</h4>
                  <p>Всего: <strong>{selectedEmployeeReport.totalGoals}</strong></p>
                  <p>Завершено: <strong>{selectedEmployeeReport.completedGoals}</strong></p>
                  <p>Среднее по команде: <strong>{selectedEmployeeReport.teamAvgGoals.toFixed(1)}</strong></p>
                </div>
                <div className="card">
                  <h4>Задачи</h4>
                  <p>Всего: <strong>{selectedEmployeeReport.totalTasksEmp}</strong></p>
                  <p>Выполнено: <strong>{selectedEmployeeReport.completedTasks}</strong></p>
                  <p>Среднее по команде: <strong>{selectedEmployeeReport.teamAvgCompletedTasks.toFixed(1)}</strong></p>
                </div>
              </div>

              <div style={{marginTop: 16}}>
                <h4>Список целей</h4>
                {selectedEmployeeReport.empGoals.length === 0 ? (
                  <p className="empty">Целей не найдено.</p>
                ) : (
                  <ul className="metrics-list">
                    {selectedEmployeeReport.empGoals.map((g) => (
                      <li key={g.id}>
                        <div>
                          <strong>{g.title}</strong>
                          <span>{g.is_completed ? 'Завершена' : 'В процессе'}</span>
                        </div>
                        <span className="chip">{g.goal_type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <footer className="modal-footer">
              <button type="button" className="btn ghost" onClick={closeEmployeeReport}>Закрыть</button>
            </footer>
          </div>
        </div>
      )}

      <section className="grid panels">
        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="panel-overline">Нагрузка по целям</p>
              <h2>Прогресс сотрудников</h2>
            </div>
          </header>
          <ul className="metrics-list">
            {Object.values(metrics.goalMetricsByEmployee).length === 0 ? (
              <li className="empty">Целей пока не назначено.</li>
            ) : (
              Object.values(metrics.goalMetricsByEmployee).map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.total} целей</span>
                  </div>
                  <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                    {item.overdue > 0 && <span className="chip warning">Просрочено: {item.overdue}</span>}
                    <button type="button" className="btn inline" onClick={() => openEmployeeReport(item.id)}>
                      Подробнее
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="panel-overline">Задачи команды</p>
              <h2>Исполнение</h2>
            </div>
          </header>
          <ul className="metrics-list">
            {Object.values(metrics.taskMetricsByEmployee).length === 0 ? (
              <li className="empty">Задач по целям пока нет.</li>
            ) : (
              Object.values(metrics.taskMetricsByEmployee).map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.total} задач</span>
                  </div>
                  <span className="chip success">Выполнено: {item.completed}</span>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>

      <section className="grid panels">
        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="panel-overline">Кадровые риски</p>
              <h2>Зона внимания</h2>
            </div>
          </header>
          <ul className="metrics-list">
            {metrics.highRiskEmployees.length === 0 ? (
              <li className="empty">Критичных рисков удержания не выявлено.</li>
            ) : (
              metrics.highRiskEmployees.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{entry.name}</strong>
                    <span>Риск: {entry.risk} / 10</span>
                  </div>
                  <span className="chip warning">Требуется план удержания</span>
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="panel-overline">Преемственность</p>
              <h2>Кандидаты в резерв</h2>
            </div>
            <span className="panel-badge">{metrics.successorCount} сотрудников</span>
          </header>
          <ul className="metrics-list">
            {metrics.readinessLeaders.length === 0 ? (
              <li className="empty">Пока нет кандидатов в кадровый резерв.</li>
            ) : (
              metrics.readinessLeaders.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{entry.name}</strong>
                    <span>Готовность: {entry.readiness || 'n/a'}</span>
                  </div>
                  <span className="chip">В резерве</span>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>
    </div>
  );
}

export default Reports;
