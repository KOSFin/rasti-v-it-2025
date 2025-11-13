import { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import {
  getAdaptationIndex,
  getReviewAnalytics,
  getSkillReviewOverview,
  getFinalReviewStatistics,
  getNineBoxMatrix,
  listDepartments,
  listEmployees,
  listOrganizations,
  listTeams,
} from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const SKILL_FILTERS = [
  { label: 'Все навыки', value: 'all' },
  { label: 'Hard skills', value: 'hard' },
  { label: 'Soft skills', value: 'soft' },
];

function EmployeeDashboard({ user, employee }) {
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

function AdminDashboard({ user }) {
  const [counts, setCounts] = useState({
    employees: null,
    managers: null,
    organizations: null,
    departments: null,
    teams: null,
  });
  const [finalStats, setFinalStats] = useState(null);
  const [nineBox, setNineBox] = useState({ entries: [], summary: summarizeNineBox([]) });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [
          employeesCount,
          managersCount,
          organizationsCount,
          departmentsCount,
          teamsCount,
          finalStatsResponse,
          nineBoxResponse,
        ] = await Promise.all([
          fetchCount(listEmployees),
          fetchCount(listEmployees, { role: 'manager' }),
          fetchCount(listOrganizations),
          fetchCount(listDepartments),
          fetchCount(listTeams),
          getFinalReviewStatistics()
            .then((response) => response?.data ?? null)
            .catch((statsError) => {
              if (statsError?.response?.status === 403) {
                return null;
              }
              throw statsError;
            }),
          getNineBoxMatrix()
            .then((response) => response?.data ?? [])
            .catch((matrixError) => {
              if (matrixError?.response?.status === 403) {
                return [];
              }
              throw matrixError;
            }),
        ]);

        if (ignore) {
          return;
        }

        setCounts({
          employees: employeesCount,
          managers: managersCount,
          organizations: organizationsCount,
          departments: departmentsCount,
          teams: teamsCount,
        });
        setFinalStats(finalStatsResponse);
        const entries = Array.isArray(nineBoxResponse) ? nineBoxResponse : [];
        setNineBox({ entries, summary: summarizeNineBox(entries) });
      } catch (loadError) {
        if (ignore) {
          return;
        }
        console.error('Не удалось получить сводные метрики', loadError);
        setError('Не удалось получить сводные метрики. Повторите попытку позже.');
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [refreshIndex]);

  const heroMetrics = useMemo(
    () => [
      {
        label: 'Сотрудники',
        value: formatCountValue(counts.employees),
        hint: 'Активных профилей',
      },
      {
        label: 'Руководители',
        value: formatCountValue(counts.managers),
        hint: 'С доступом к командам',
      },
      {
        label: 'Средняя итоговая оценка',
        value: formatScoreValue(finalStats?.average_score),
        hint: 'По завершённым финальным отзывам',
      },
      {
        label: 'Отзывов собрано',
        value: formatCountValue(finalStats?.total_reviews),
        hint: 'Финальные обзоры в системе',
      },
    ],
    [counts.employees, counts.managers, finalStats?.average_score, finalStats?.total_reviews],
  );

  const structureMetrics = useMemo(
    () => [
      {
        label: 'Организации',
        value: formatCountValue(counts.organizations),
        hint: 'Активные юрлица и филиалы',
      },
      {
        label: 'Отделы',
        value: formatCountValue(counts.departments),
        hint: 'Структурные подразделения',
      },
      {
        label: 'Команды',
        value: formatCountValue(counts.teams),
        hint: 'Проектные группы',
      },
      {
        label: 'В 9-box',
        value: formatCountValue(nineBox.summary.total),
        hint: 'Сотрудники с оценкой потенциала',
      },
    ],
    [counts.organizations, counts.departments, counts.teams, nineBox.summary.total],
  );

  const recommendationMetrics = finalStats?.salary_recommendations ?? {
    include: 0,
    conditional: 0,
    exclude: 0,
  };

  const topTalents = useMemo(
    () =>
      nineBox.entries
        .filter((item) => clampNineBox(item.nine_box_x) === 2 && clampNineBox(item.nine_box_y) === 2)
        .sort(
          (a, b) =>
            (b.performance_score ?? 0) + (b.potential_score ?? 0) - ((a.performance_score ?? 0) + (a.potential_score ?? 0)),
        )
        .slice(0, 5),
    [nineBox.entries],
  );

  const attentionList = useMemo(
    () =>
      nineBox.entries
        .filter((item) => clampNineBox(item.nine_box_x) === 0 || clampNineBox(item.nine_box_y) === 0)
        .slice(0, 5),
    [nineBox.entries],
  );

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" aria-hidden="true" />
        <span>Собираем сводку по компании…</span>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {error && <div className="dashboard-error">{error}</div>}

      <section className="dashboard-hero admin-hero">
        <div className="hero-top">
          <div>
            <p className="hero-overline">
              Панель администратора · {user?.first_name || user?.username || 'Администратор'}
            </p>
            <h1>Сводка по компании</h1>
            <p className="hero-subtitle">Контролируйте процессы адаптации, оценки и развития сотрудников</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRefreshIndex((index) => index + 1)}
            disabled={loading}
          >
            <FiRefreshCw size={16} /> Обновить
          </button>
        </div>
        <div className="hero-metrics">
          {heroMetrics.map((metric) => (
            <div key={metric.label}>
              <span className="metric-label">{metric.label}</span>
              <span className="metric-value">{metric.value}</span>
              <span className="metric-hint">{metric.hint}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="insights-grid admin-structure">
        {structureMetrics.map((metric) => (
          <article key={metric.label} className="insight-card">
            <h3>{metric.label}</h3>
            <p className="insight-number">{metric.value}</p>
            <p className="insight-meta">{metric.hint}</p>
          </article>
        ))}
        <article className="insight-card zone-blue">
          <h3>Звёзды</h3>
          <p className="insight-number">{formatCountValue(nineBox.summary.stars)}</p>
          <p className="insight-meta">Высокий потенциал и результативность</p>
        </article>
        <article className="insight-card zone-yellow">
          <h3>Готовы к росту</h3>
          <p className="insight-number">{formatCountValue(nineBox.summary.highPotential)}</p>
          <p className="insight-meta">Нуждаются в программах развития</p>
        </article>
        <article className="insight-card zone-red">
          <h3>Зона внимания</h3>
          <p className="insight-number">{formatCountValue(nineBox.summary.attention)}</p>
          <p className="insight-meta">Сотрудники с рисками по оценкам</p>
        </article>
      </section>

      <section className="summary-strip admin-summary">
        <article className="summary-card">
          <h3>Рекомендуем к поощрению</h3>
          <p className="summary-main">{formatCountValue(recommendationMetrics.include)}</p>
          <p className="summary-meta">На основании финальных обзоров</p>
        </article>
        <article className="summary-card highlight">
          <h3>Требуют обсуждения</h3>
          <p className="summary-main">{formatCountValue(recommendationMetrics.conditional)}</p>
          <p className="summary-meta">Рекомендуем согласование с HR</p>
        </article>
        <article className="summary-card">
          <h3>Нужны меры</h3>
          <p className="summary-main">{formatCountValue(recommendationMetrics.exclude)}</p>
          <p className="summary-meta">Сотрудники из группы риска</p>
        </article>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="panel-header">
            <h2>Таланты 9-box</h2>
            <span>
              {formatCountValue(topTalents.length)} из {formatCountValue(nineBox.summary.total)}
            </span>
          </div>
          {topTalents.length === 0 ? (
            <div className="empty">Пока нет оценок потенциала. Проведите оценку, чтобы увидеть талантов.</div>
          ) : (
            <ul className="talent-list">
              {topTalents.map((entry) => (
                <li key={entry.employee_id}>
                  <div>
                    <strong>{entry.employee_name}</strong>
                    <span>{entry.position || '—'}</span>
                  </div>
                  <span className="tag accent">
                    {formatScoreValue(entry.performance_score, 0)} / {formatScoreValue(entry.potential_score, 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="panel-header">
            <h2>Зона внимания</h2>
            <span>{formatCountValue(attentionList.length)}</span>
          </div>
          {attentionList.length === 0 ? (
            <div className="empty">Рисковых сотрудников не обнаружено.</div>
          ) : (
            <ul className="talent-list risk">
              {attentionList.map((entry) => (
                <li key={`risk-${entry.employee_id}`}>
                  <div>
                    <strong>{entry.employee_name}</strong>
                    <span>{entry.position || '—'}</span>
                  </div>
                  <span className="tag warning">{statusByQuadrant(entry)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Dashboard() {
  const { user, employee } = useAuth();
  if (user?.is_superuser) {
    return <AdminDashboard user={user} />;
  }
  return <EmployeeDashboard user={user} employee={employee} />;
}

function fetchCount(fetcher, params = {}) {
  return fetcher({ params: { page_size: 1, ...params } }).then((response) => extractCount(response?.data));
}

function extractCount(payload) {
  if (!payload) {
    return null;
  }
  if (typeof payload.count === 'number') {
    return payload.count;
  }
  if (payload.data) {
    return extractCount(payload.data);
  }
  if (Array.isArray(payload.results)) {
    return payload.results.length;
  }
  if (Array.isArray(payload)) {
    return payload.length;
  }
  return null;
}

function summarizeNineBox(entries) {
  const result = {
    total: Array.isArray(entries) ? entries.length : 0,
    stars: 0,
    highPotential: 0,
    attention: 0,
  };

  if (!Array.isArray(entries)) {
    return result;
  }

  const grid = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => 0));

  entries.forEach((entry) => {
    const x = clampNineBox(entry?.nine_box_x);
    const y = clampNineBox(entry?.nine_box_y);
    grid[y][x] += 1;
  });

  result.stars = grid[2][2];
  result.highPotential = grid[2][1] + grid[1][2];
  result.attention = grid[0][0] + grid[0][1] + grid[0][2] + grid[1][0] + grid[2][0];
  return result;
}

function clampNineBox(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(2, Math.round(value)));
}

function formatCountValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('ru-RU');
  }
  return '—';
}

function formatScoreValue(value, digits = 1) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(digits);
  }
  return '—';
}

function statusByQuadrant(entry) {
  const x = clampNineBox(entry?.nine_box_x);
  const y = clampNineBox(entry?.nine_box_y);

  if (x === 2 && y === 2) {
    return 'Звезда';
  }
  if (y === 2 || x === 2) {
    return 'Готов к росту';
  }
  if (x === 0 && y === 0) {
    return 'Низкий потенциал и результативность';
  }
  if (x === 0) {
    return 'Низкая результативность';
  }
  if (y === 0) {
    return 'Низкий потенциал';
  }
  return 'Стабильная зона';
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
