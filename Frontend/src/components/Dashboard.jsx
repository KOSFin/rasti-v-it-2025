import { useEffect, useMemo, useState } from 'react';
import { getAdaptationIndex, getReviewAnalytics } from '../api/services';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    if (!analytics?.analytics) {
      return [];
    }
    const ordered = [];
    const seen = new Set();
    analytics.analytics.forEach((category) => {
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
  }, [analytics]);

  const categories = analytics?.analytics || [];

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
              {employee?.position || 'Сотрудник'} · {employee?.fio || employee?.full_name}
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
            <span className="metric-label">Индекс адаптации</span>
            <span className="metric-value accent">{adaptation?.AdaptationIndex?.toFixed?.(1) ?? '—'}</span>
          </div>
          <div>
            <span className="metric-label">Средняя самооценка</span>
            <span className="metric-value">{analytics?.averages?.overall_self?.toFixed?.(1) ?? '0.0'}</span>
          </div>
          <div>
            <span className="metric-label">Средняя оценка коллег</span>
            <span className="metric-value">{analytics?.averages?.overall_peer?.toFixed?.(1) ?? '0.0'}</span>
          </div>
          <div>
            <span className="metric-label">Δ восприятия</span>
            <span className="metric-value">{analytics?.averages?.delta?.toFixed?.(1) ?? '0.0'}</span>
          </div>
        </div>
      </section>

      <section className="insights-grid">
        <article className={`insight-card zone-${adaptation?.color_zone || 'neutral'}`}>
          <h3>Интерпретация зоны</h3>
          <p className="insight-number">{(adaptation?.AdaptationIndex ?? 0).toFixed(1)}</p>
          <p className="insight-meta">{adaptation?.interpretation || 'Недостаточно данных для интерпретации.'}</p>
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

export default Dashboard;
