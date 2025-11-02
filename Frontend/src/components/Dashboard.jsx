import { useEffect, useMemo, useState } from 'react';
import { getAdaptationIndex, getReviewAnalytics, getSkillReviewOverview } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const SKILL_FILTERS = [
  { label: 'Все навыки', value: 'all' },
  { label: 'Hard skills', value: 'hard' },
  { label: 'Soft skills', value: 'soft' },
];

function Dashboard() {
  const { user, employee } = useAuth();
  const [skillsType, setSkillsType] = useState('all');
  const [periodId, setPeriodId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [adaptation, setAdaptation] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overviewError, setOverviewError] = useState('');

  useEffect(() => {
    if (!employee?.employer_id && !employee?.id) {
      return;
    }

    let ignore = false;

    const loadOverview = async () => {
      setOverviewError('');
      try {
        const params = employee?.employer_id ? { employer_id: employee.employer_id } : {};
        const response = await getSkillReviewOverview(params);
        if (!ignore) {
          setOverview(response.data);
        }
      } catch (fetchError) {
        console.error('Не удалось загрузить общий обзор по самооценкам', fetchError);
        if (!ignore) {
          setOverviewError('Не удалось загрузить сводные метрики.');
        }
      }
    };

    loadOverview();

    return () => {
      ignore = true;
    };
  }, [employee?.employer_id, employee?.id]);

  useEffect(() => {
    if (!employee?.id) {
      return;
    }

    let ignore = false;

    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const [analyticsRes, adaptationRes] = await Promise.all([
          getReviewAnalytics({
            employer_id: employee.id,
            skills_type: skillsType,
            ...(periodId ? { period_id: periodId } : {}),
          }),
          getAdaptationIndex({
            employer_id: employee.id,
            skills_type: skillsType,
            ...(periodId ? { period_id: periodId } : {}),
          }),
        ]);

        if (ignore) {
          return;
        }

        setAnalytics(analyticsRes.data);
        setAdaptation(adaptationRes.data);
      } catch (fetchError) {
        console.error('Не удалось загрузить аналитику', fetchError);
        if (!ignore) {
          setError('Не удалось загрузить данные. Попробуйте позже.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, [employee?.id, skillsType, periodId]);

  const periods = useMemo(() => {
    const sourceAnalytics = analytics?.analytics || overview?.analytics?.analytics;
    if (!sourceAnalytics) {
      return [];
    }
    const ordered = [];
    const seen = new Set();
    sourceAnalytics.forEach((category) => {
      category.periods.forEach((item) => {
        const key = item.period_id ?? item.period;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        ordered.push(item);
      });
    });
    return ordered;
  }, [analytics, overview]);

  const categories = analytics?.analytics || overview?.analytics?.analytics || [];

  const summary = overview?.summary || {};
  const nextReview = overview?.next_review;
  const activeReview = overview?.active_review;
  const timeline = overview?.timeline || [];

  const overallScore = summary.self_average != null && summary.peer_average != null
    ? ((summary.self_average + summary.peer_average) / 2).toFixed(1)
    : '—';

  const growthValue = summary.last_growth != null
    ? (summary.last_growth >= 0 ? `+${summary.last_growth.toFixed(1)}` : summary.last_growth.toFixed(1))
    : '—';

  const efficiencyValue = summary.performance_index != null
    ? `${summary.performance_index.toFixed(1)}%`
    : summary.reviews_completion_rate != null
      ? `${summary.reviews_completion_rate.toFixed(1)}%`
      : '—';

  const completedTests = summary.tests_completed ?? 0;
  const totalTests = summary.tests_total ?? timeline.length;
  const criteriaLabel = totalTests ? `${completedTests}/${totalTests}` : '0/0';

  const adaptationIndexValue = summary.adaptation_index ?? adaptation?.AdaptationIndex;
  const adaptationZone = summary.adaptation_zone || adaptation?.color_zone;
  const adaptationInterpretation = summary.adaptation_interpretation || adaptation?.interpretation;

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" aria-hidden="true" />
        <span>Собираем обновлённые метрики…</span>
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
            <h1>Performance Review 360°</h1>
            <p className="hero-subtitle">
              {employee?.position_title || employee?.position_name || 'Сотрудник'} · {employee?.fio || employee?.full_name}
            </p>
          </div>
          <div className="filters">
            <div className="filter-group">
              {SKILL_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={option.value === skillsType ? 'filter active' : 'filter'}
                  onClick={() => setSkillsType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <select
              value={periodId ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setPeriodId(value ? Number(value) : null);
              }}
            >
              <option value="">Все периоды</option>
              {periods.map((period) => (
                <option key={period.period} value={period.period_id ?? ''} disabled={!period.period_id}>
                  {period.period}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="hero-metrics">
          <div>
            <span className="metric-label">Общий балл</span>
            <span className="metric-value accent">{overallScore}</span>
            <span className="metric-hint">Среднее Self + Peer</span>
          </div>
          <div>
            <span className="metric-label">Рост за период</span>
            <span className="metric-value success">{growthValue}</span>
            <span className="metric-hint">Последняя динамика</span>
          </div>
          <div>
            <span className="metric-label">Общая эффективность</span>
            <span className="metric-value">{efficiencyValue}</span>
            <span className="metric-hint">Индекс результативности</span>
          </div>
          <div>
            <span className="metric-label">Тестов завершено</span>
            <span className="metric-value">{criteriaLabel}</span>
            <span className="metric-hint">Самооценки / план</span>
          </div>
        </div>
      </section>

      {overviewError && <div className="dashboard-error subtle">{overviewError}</div>}

      {nextReview && (
        <section className="summary-strip">
          <article className="summary-card">
            <h3>Ближайший тест</h3>
            <p className="summary-main">{nextReview.period_label}</p>
            <p className="summary-meta">
              Через {Math.max(nextReview.days_left ?? 0, 0)} дн. · {new Date(nextReview.due_date).toLocaleDateString('ru-RU')}
            </p>
          </article>
          {activeReview && (
            <article className="summary-card highlight">
              <h3>Доступно к заполнению</h3>
              <p className="summary-main">{activeReview.period_label}</p>
              <p className="summary-meta">
                Статус: {statusLabel(activeReview.status)} · Срок до {new Date(activeReview.due_date).toLocaleDateString('ru-RU')}
              </p>
            </article>
          )}
          <article className="summary-card">
            <h3>Адаптация</h3>
            <p className={`summary-main zone-${adaptationZone || 'neutral'}`}>
              {adaptationIndexValue != null ? adaptationIndexValue.toFixed?.(1) ?? adaptationIndexValue : '—'}
            </p>
            <p className="summary-meta">{adaptationInterpretation || 'Недостаточно данных'}</p>
          </article>
        </section>
      )}

      <section className="insights-grid">
        <article className={`insight-card zone-${adaptationZone || 'neutral'}`}>
          <h3>Индекс адаптации</h3>
          <p className="insight-number">{adaptationIndexValue != null ? adaptationIndexValue.toFixed?.(1) ?? adaptationIndexValue : '—'}</p>
          <p className="insight-meta">{adaptationInterpretation || 'Недостаточно данных для интерпретации.'}</p>
        </article>
        <article className="insight-card">
          <h3>Средняя самооценка</h3>
          <p className="insight-number success">{analytics?.averages?.overall_self?.toFixed?.(1) ?? '0.0'}</p>
          <p className="insight-meta">По всем категориям выбранного фильтра</p>
        </article>
        <article className="insight-card">
          <h3>Средняя оценка коллег</h3>
          <p className="insight-number accent">{analytics?.averages?.overall_peer?.toFixed?.(1) ?? '0.0'}</p>
          <p className="insight-meta">Средневзвешенное по всем периодам</p>
        </article>
        <article className="insight-card">
          <h3>Разница восприятия</h3>
          <p className="insight-number warning">{analytics?.averages?.delta?.toFixed?.(1) ?? '0.0'}</p>
          <p className="insight-meta">Peer − Self</p>
        </article>
      </section>

      <section className="dashboard-grid single">
        <div className="dashboard-panel">
          <div className="panel-header">
            <h2>Динамика по категориям</h2>
            <span>{categories.length}</span>
          </div>
          {categories.length === 0 ? (
            <div className="empty">Пока нет данных о прохождении оценок.</div>
          ) : (
            <div className="category-grid">
              {categories.map((category) => {
                const latestPeriod = category.periods[category.periods.length - 1] || null;
                return (
                  <article key={`${category.skill_type}-${category.category}`} className="category-card">
                    <header>
                      <h3>{category.category}</h3>
                      <span className={`tag ${category.skill_type === 'hard' ? 'accent' : 'soft'}`}>
                        {category.skill_type === 'hard' ? 'Hard skill' : 'Soft skill'}
                      </span>
                    </header>
                    <table>
                      <thead>
                        <tr>
                          <th>Период</th>
                          <th>Self</th>
                          <th>Peer</th>
                          <th>Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.periods.map((period) => (
                          <tr key={period.period}>
                            <td>{period.period}</td>
                            <td>{period.self !== null ? period.self.toFixed(1) : '—'}</td>
                            <td>{period.peer !== null ? period.peer.toFixed(1) : '—'}</td>
                            <td>{period.peer !== null && period.self !== null ? (period.peer - period.self).toFixed(1) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <footer>
                      <span>Δ Self: {formatTrend(latestPeriod?.trend_self)}</span>
                      <span>Δ Peer: {formatTrend(latestPeriod?.trend_peer)}</span>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatTrend(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  const signed = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  return `${signed}`;
}

function statusLabel(status) {
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
}

export default Dashboard;
