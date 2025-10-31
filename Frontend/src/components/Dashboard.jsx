import { useEffect, useMemo, useState } from 'react';
import {
  getGoals,
  getTasks,
  getSelfAssessments,
  getFeedback360ForMe,
  getPendingFeedback360,
  getManagerReviews,
  getFinalReviewStatistics,
} from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const extractResults = (response) => {
  if (!response?.data) {
    return [];
  }
  if (Array.isArray(response.data?.results)) {
    return response.data.results;
  }
  return Array.isArray(response.data) ? response.data : response.data?.results || [];
};

function Dashboard() {
  const { user, employee } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    goals: [],
    tasks: [],
    selfAssessments: [],
    feedbackReceived: [],
    feedbackPending: [],
    managerReviews: [],
    finalStats: null,
  });

  useEffect(() => {
    let ignore = false;

    const fetchDashboardData = async () => {
      if (!employee) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const requests = [
          getGoals({ page_size: 100, ordering: '-created_at' }),
          getTasks({ page_size: 200 }),
          getSelfAssessments({ page_size: 50, ordering: '-created_at' }),
          getFeedback360ForMe(),
          getPendingFeedback360(),
        ];

        if (employee.is_manager) {
          requests.push(getManagerReviews({ page_size: 50, ordering: '-created_at' }));
          requests.push(getFinalReviewStatistics());
        }

        const responses = await Promise.allSettled(requests);

        if (ignore) {
          return;
        }

        const [goalsRes, tasksRes, assessmentsRes, feedbackRes, pendingRes, managerRes, finalStatsRes] = responses;

        setData({
          goals: extractResults(goalsRes?.value) || [],
          tasks: extractResults(tasksRes?.value) || [],
          selfAssessments: extractResults(assessmentsRes?.value) || [],
          feedbackReceived: Array.isArray(feedbackRes?.value?.data)
            ? feedbackRes.value.data
            : extractResults(feedbackRes?.value) || [],
          feedbackPending: Array.isArray(pendingRes?.value?.data)
            ? pendingRes.value.data
            : extractResults(pendingRes?.value) || [],
          managerReviews: extractResults(managerRes?.value) || [],
          finalStats: finalStatsRes?.value?.data || null,
        });
      } catch (fetchError) {
        console.error('Не удалось обновить дашборд', fetchError);
        if (!ignore) {
          setError('Не удалось обновить данные. Попробуйте позже.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      ignore = true;
    };
  }, [employee]);

  const metrics = useMemo(() => {
    const now = new Date();
    const openTasks = data.tasks.filter((task) => !task.is_completed);
    const completedTasks = data.tasks.filter((task) => task.is_completed);
    const activeGoals = data.goals.filter((goal) => !goal.end_date || new Date(goal.end_date) >= now);
    const goalsDueSoon = data.goals.filter((goal) => {
      if (!goal.end_date) {
        return false;
      }
      const diff = (new Date(goal.end_date) - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    });

    const feedbackDone = data.feedbackReceived.length;
    const pendingFeedback = data.feedbackPending.length;

    return {
      openTasks: openTasks.length,
      totalTasks: data.tasks.length,
      completedTasks: completedTasks.length,
      activeGoals: activeGoals.length,
      goalsDueSoon: goalsDueSoon.length,
      feedbackDone,
      pendingFeedback,
      selfAssessments: data.selfAssessments.length,
    };
  }, [data]);

  const activityFeed = useMemo(() => {
    const feed = [];

    data.selfAssessments.forEach((item) => {
      feed.push({
        id: `self-${item.id}`,
        type: 'self',
        title: item.task_title,
        date: item.created_at,
        meta: `${item.calculated_score} баллов`,
      });
    });

    data.feedbackReceived.forEach((item) => {
      feed.push({
        id: `fb-${item.id}`,
        type: 'feedback',
        title: item.assessor_name,
        date: item.created_at,
        meta: item.task_title,
      });
    });

    data.managerReviews.forEach((item) => {
      feed.push({
        id: `mgr-${item.id}`,
        type: 'manager',
        title: employee?.is_manager ? item.employee_name : item.manager_name,
        date: item.created_at,
        meta: item.task_title,
      });
    });

    return feed
      .filter((entry) => entry.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
  }, [data, employee?.is_manager]);

  const recentGoals = useMemo(() => {
    return [...data.goals]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 4);
  }, [data.goals]);

  const focusTasks = useMemo(() => {
    return data.tasks
      .filter((task) => !task.is_completed)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, 5);
  }, [data.tasks]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" aria-hidden="true" />
        <span>Подгружаем ваши данные…</span>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {error && <div className="dashboard-error">{error}</div>}

      <section className="dashboard-hero">
        <div className="hero-top">
          <div>
            <p className="hero-overline">Добро пожаловать, {user?.first_name}</p>
            <h1>
              Ваше развитие в {employee?.department_name || 'команде'}
            </h1>
            <p className="hero-subtitle">
              {employee?.position || 'Сотрудник'} · {metrics.activeGoals} активных целей · {metrics.openTasks} задач в работе
            </p>
          </div>
        </div>
        <div className="hero-metrics">
          <div>
            <span className="metric-label">Целей в фокусе</span>
            <span className="metric-value">{metrics.activeGoals}</span>
          </div>
          <div>
            <span className="metric-label">Задач активных</span>
            <span className="metric-value">{metrics.openTasks}</span>
          </div>
          <div>
            <span className="metric-label">Оценок 360 получено</span>
            <span className="metric-value">{metrics.feedbackDone}</span>
          </div>
          <div>
            <span className="metric-label">Самооценок</span>
            <span className="metric-value">{metrics.selfAssessments}</span>
          </div>
        </div>
      </section>

      <section className="insights-grid">
        <article className="insight-card">
          <h3>Прогресс задач</h3>
          <p className="insight-number">
            {metrics.completedTasks}/{metrics.totalTasks}
          </p>
          <p className="insight-meta">Завершено · {metrics.openTasks} в работе</p>
        </article>
        <article className="insight-card">
          <h3>Горящие цели</h3>
          <p className="insight-number warning">{metrics.goalsDueSoon}</p>
          <p className="insight-meta">Дедлайн в ближайшие 7 дней</p>
        </article>
        <article className="insight-card">
          <h3>Оценки 360</h3>
          <p className="insight-number accent">{metrics.feedbackDone}</p>
          <p className="insight-meta">{metrics.pendingFeedback} ожидают ответа</p>
        </article>
        <article className="insight-card">
          <h3>Самооценки</h3>
          <p className="insight-number success">{metrics.selfAssessments}</p>
          <p className="insight-meta">Последняя: {data.selfAssessments[0]?.created_at ? new Date(data.selfAssessments[0].created_at).toLocaleDateString('ru-RU') : '—'}</p>
        </article>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="panel-header">
            <h2>Фокус-задачи</h2>
            <span>{focusTasks.length} из {metrics.openTasks}</span>
          </div>
          <ul className="tasks-list">
            {focusTasks.length === 0 && <li className="empty">Все задачи выполнены</li>}
            {focusTasks.map((task) => (
              <li key={task.id}>
                <strong>{task.title}</strong>
                <span>{task.description}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="dashboard-panel">
          <div className="panel-header">
            <h2>Недавние цели</h2>
            <span>{recentGoals.length}</span>
          </div>
          <ul className="goals-list">
            {recentGoals.length === 0 && <li className="empty">Цели пока не созданы</li>}
            {recentGoals.map((goal) => (
              <li key={goal.id}>
                <div>
                  <strong>{goal.title}</strong>
                  <span>{goal.goal_type === 'strategic' ? 'Стратегическая цель' : goal.goal_type === 'tactical' ? 'Тактическая задача' : 'Личное развитие'}</span>
                </div>
                <span className="badge">до {goal.end_date ? new Date(goal.end_date).toLocaleDateString('ru-RU') : '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="panel-header">
            <h2>Лента активности</h2>
            <span>{activityFeed.length}</span>
          </div>
          <ul className="activity-feed">
            {activityFeed.length === 0 && <li className="empty">Активности пока нет</li>}
            {activityFeed.map((entry) => (
              <li key={entry.id} className={`type-${entry.type}`}>
                <div>
                  <strong>{entry.title}</strong>
                  {entry.meta && <span>{entry.meta}</span>}
                </div>
                <time>{new Date(entry.date).toLocaleDateString('ru-RU')}</time>
              </li>
            ))}
          </ul>
        </div>

        <div className="dashboard-panel">
          <div className="panel-header">
            <h2>Ожидают оценки 360°</h2>
            <span>{metrics.pendingFeedback}</span>
          </div>
          <ul className="pending-list">
            {data.feedbackPending.length === 0 && <li className="empty">Запросов нет</li>}
            {data.feedbackPending.map((colleague) => (
              <li key={colleague.id}>
                <strong>{colleague.full_name}</strong>
                <span>{colleague.position}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {employee?.is_manager && (
        <section className="dashboard-grid single">
          <div className="dashboard-panel">
            <div className="panel-header">
              <h2>Статистика отдела</h2>
              <span>{data.finalStats?.total_reviews || 0} итоговых отзывов</span>
            </div>
            <div className="manager-stats">
              <div>
                <span className="label">Средний балл</span>
                <span className="value">{data.finalStats?.average_score?.toFixed?.(1) || '0.0'}</span>
              </div>
              <div>
                <span className="label">Рекомендации</span>
                <div className="pill-group">
                  <span className="pill success">{data.finalStats?.salary_recommendations?.include || 0} включены</span>
                  <span className="pill warning">{data.finalStats?.salary_recommendations?.conditional || 0} условно</span>
                  <span className="pill danger">{data.finalStats?.salary_recommendations?.exclude || 0} исключены</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default Dashboard;
