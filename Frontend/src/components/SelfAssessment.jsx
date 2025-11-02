import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSelfAssessments, getPendingSelfAssessments, getSkillReviewOverview } from '../api/services';
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

const statusLabel = (status) => {
  switch (status) {
    case 'completed':
      return 'Завершено';
    case 'open':
      return 'Открыто';
    case 'overdue':
      return 'Просрочено';
    case 'due_today':
      return 'Сдать сегодня';
    case 'expired':
      return 'Ссылка истекла';
    case 'scheduled':
      return 'Запланировано';
    default:
      return 'В ожидании';
  }
};

function SelfAssessment() {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const [pendingGoals, setPendingGoals] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!employee) {
      setOverview(null);
      setPendingGoals([]);
      setAssessments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [overviewRes, pendingRes, assessmentsRes] = await Promise.all([
        getSkillReviewOverview(employee?.employer_id ? { employer_id: employee.employer_id } : {}),
        getPendingSelfAssessments(),
        getSelfAssessments({ page_size: 200, ordering: '-created_at' }),
      ]);

      setOverview(overviewRes.data);
      setPendingGoals(extractResults(pendingRes));
      setAssessments(extractResults(assessmentsRes));
    } catch (err) {
      console.error('Не удалось загрузить данные самооценки', err);
      setError('Не удалось загрузить данные. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = overview?.summary || {};
  const timeline = overview?.timeline || [];
  const nextReview = overview?.next_review;
  const activeReview = overview?.active_review;
  const activationDate = overview?.activation_date;

  const metrics = useMemo(() => {
    const historyAverage = assessments.length
      ? (
          assessments.reduce((sum, item) => sum + (item.calculated_score || 0), 0) /
          assessments.length
        ).toFixed(1)
      : '0.0';

    const selfAvg = summary.self_average != null ? summary.self_average.toFixed(1) : '—';
    const peerAvg = summary.peer_average != null ? summary.peer_average.toFixed(1) : '—';
    const deltaAvg = summary.delta != null ? summary.delta.toFixed(1) : '—';
    const adaptationIndex = summary.adaptation_index != null ? summary.adaptation_index.toFixed(1) : '—';
    const completion = summary.reviews_completion_rate != null ? `${summary.reviews_completion_rate.toFixed(1)}%` : '—';
    const completed = summary.tests_completed ?? timeline.filter((item) => item.status === 'completed').length;
    const planned = summary.tests_total ?? timeline.length;

    return {
      count: assessments.length,
      average: historyAverage,
      selfAvg,
      peerAvg,
      deltaAvg,
      adaptationIndex,
      completion,
      completed,
      planned,
      lastDate: assessments[0]?.created_at
        ? new Date(assessments[0].created_at).toLocaleDateString('ru-RU')
        : '—',
      awaiting: pendingGoals.length,
    };
  }, [assessments, pendingGoals, summary, timeline]);

  const scheduleStats = useMemo(() => {
    if (!timeline.length) {
      return { completed: 0, overdue: 0, upcoming: 0 };
    }
    return timeline.reduce(
      (acc, entry) => {
        if (entry.status === 'completed') {
          acc.completed += 1;
        } else if (entry.status === 'overdue') {
          acc.overdue += 1;
        } else if (['open', 'due_today', 'scheduled'].includes(entry.status)) {
          acc.upcoming += 1;
        }
        return acc;
      },
      { completed: 0, overdue: 0, upcoming: 0 }
    );
  }, [timeline]);

  const handleStartReview = () => {
    if (activeReview?.token) {
      navigate(`/reviews/skills/${activeReview.token}`);
    }
  };

  const formattedActivation = activationDate ? new Date(activationDate).toLocaleDateString('ru-RU') : '—';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Самооценка</h1>
          <p className="page-subtitle">
            Самооценка запускается автоматически после завершения цели с обязательной оценкой.
            Заполните форму в модальном окне, которое откроется сразу после завершения.
          </p>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      <section className="page-section">
        <article className="panel">
          <header className="panel-header">
            <div>
              <h2>Периодические тесты для оценки скилов</h2>
              <span>База активирована {formattedActivation}</span>
            </div>
            {activeReview?.token && (
              <button type="button" className="btn-primary" onClick={handleStartReview}>
                Пройти текущий тест
              </button>
            )}
          </header>

          <div className="insights-grid">
            <article className="insight-card">
              <h3>Средняя самооценка</h3>
              <p className="insight-number success">{metrics.selfAvg}</p>
              <p className="insight-meta">По всем периодам</p>
            </article>
            <article className="insight-card">
              <h3>Средняя оценка коллег</h3>
              <p className="insight-number accent">{metrics.peerAvg}</p>
              <p className="insight-meta">Взвешенный балл</p>
            </article>
            <article className="insight-card">
              <h3>Δ Peer-Self</h3>
              <p className="insight-number warning">{metrics.deltaAvg}</p>
              <p className="insight-meta">Разница восприятия</p>
            </article>
            <article className="insight-card zone-blue">
              <h3>Индекс адаптации</h3>
              <p className="insight-number">{metrics.adaptationIndex}</p>
              <p className="insight-meta">Сводный показатель</p>
            </article>
            <article className="insight-card">
              <h3>Самооценок закрыто</h3>
              <p className="insight-number accent">
                {metrics.completed}/{metrics.planned || '—'}
              </p>
              <p className="insight-meta">По графику</p>
            </article>
            <article className="insight-card">
              <h3>Завершённые цели</h3>
              <p className="insight-number">{metrics.count}</p>
              <p className="insight-meta">С данными самооценками</p>
            </article>
          </div>

          <div className="summary-strip mt-24">
            <article className="summary-card">
              <h3>Ближайший тест</h3>
              <p className="summary-main">
                {nextReview ? nextReview.period_label : 'Нет в расписании'}
              </p>
              {nextReview && (
                <p className="summary-meta">
                  Через {Math.max(nextReview.days_left ?? 0, 0)} дн. · {new Date(nextReview.due_date).toLocaleDateString('ru-RU')}
                </p>
              )}
            </article>
            <article className="summary-card highlight">
              <h3>Статус расписания</h3>
              <p className="summary-main">
                {scheduleStats.completed} выполнено / {scheduleStats.upcoming} в очереди
              </p>
              <p className="summary-meta">
                Просрочено: {scheduleStats.overdue}
              </p>
            </article>
            <article className="summary-card">
              <h3>Средний балл последнего теста</h3>
              <p className="summary-main">{metrics.average}</p>
              <p className="summary-meta">История целей</p>
            </article>
          </div>

          <div className="table-wrapper mt-24">
            {loading ? (
              <p className="empty">Обновляем расписание…</p>
            ) : timeline.length === 0 ? (
              <p className="empty">Расписание самооценок ещё не сформировано.</p>
            ) : (
              <table className="status-table">
                <thead>
                  <tr>
                    <th>Период</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    <th>Балл</th>
                    <th>Ссылка</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((entry) => (
                    <tr key={`${entry.period_label}-${entry.due_date}`}>
                      <td>{entry.period_label}</td>
                      <td>{new Date(entry.due_date).toLocaleDateString('ru-RU')}</td>
                      <td>
                        <span className={`tag status-${entry.status}`}>{statusLabel(entry.status)}</span>
                      </td>
                      <td>{typeof entry.score === 'number' ? entry.score.toFixed(1) : entry.score || '—'}</td>
                      <td>
                        {entry.token ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => navigate(`/reviews/skills/${entry.token}`)}
                          >
                            Открыть
                          </button>
                        ) : (
                          <span className="tag muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </section>

      <section className="page-section">
        <article className="panel">
          <header className="panel-header">
            <h2>Завершённые цели без самооценки</h2>
            <span>{pendingGoals.length}</span>
          </header>
          {loading ? (
            <div className="panel placeholder">Загружаем список…</div>
          ) : pendingGoals.length === 0 ? (
            <p className="empty">Все цели с обязательной оценкой уже заполнены.</p>
          ) : (
            <ul className="list detailed">
              {pendingGoals.map((goal) => (
                <li key={goal.id}>
                  <div>
                    <strong>{goal.title}</strong>
                    <span>Завершена {new Date(goal.completed_at).toLocaleDateString('ru-RU')}</span>
                    <span className="tag muted">Создал {goal.creator_type === 'manager' ? 'руководитель' : 'сотрудник'}</span>
                  </div>
                  <span className="tag muted">Оценка откроется автоматически</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="page-section">
        {loading ? (
          <div className="panel placeholder">Загружаем историю…</div>
        ) : (
          <div className="cards-grid history-grid">
            {assessments.length === 0 ? (
              <div className="panel empty">
                <p>Самооценок пока нет. Они появятся после завершения первых целей.</p>
              </div>
            ) : (
              assessments.map((assessment) => (
                <article key={assessment.id} className="card assessment-card">
                  <header className="card-header">
                    <div>
                      <h3>{assessment.goal_title}</h3>
                      <span className="card-meta">{new Date(assessment.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <span className="score">{assessment.calculated_score}</span>
                  </header>
                  <div className="card-body">
                    <p><strong>Результаты:</strong> {assessment.achieved_results}</p>
                    <p><strong>Вклад:</strong> {assessment.personal_contribution}</p>
                    <p><strong>Навыки:</strong> {assessment.skills_acquired}</p>
                    <p><strong>Зоны роста:</strong> {assessment.improvements_needed}</p>
                  </div>
                  <footer className="card-footer">
                    <span className="tag">Сотрудничество {assessment.collaboration_quality}/10</span>
                    <span className="tag">Удовлетворённость {assessment.satisfaction_score}/10</span>
                  </footer>
                </article>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default SelfAssessment;
