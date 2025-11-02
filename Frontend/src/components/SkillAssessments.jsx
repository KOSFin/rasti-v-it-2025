import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSkillReviewOverview,
  getSkillReviewManagerQueue,
  submitSkillReviewFeedback,
} from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import './Common.css';
import './SkillAssessments.css';

const statusLabel = (status) => {
  switch (status) {
    case 'completed':
      return 'Закрыто';
    case 'awaiting_feedback':
      return 'Ждет фидбека';
    case 'open':
      return 'Доступно';
    case 'overdue':
      return 'Просрочено';
    case 'due_today':
      return 'Сдать сегодня';
    case 'scheduled':
      return 'Запланировано';
    case 'expired':
      return 'Ссылка истекла';
    case 'missed':
      return 'Пропущено';
    default:
      return 'В ожидании';
  }
};

const formatDate = (value) => {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleDateString('ru-RU');
  } catch (err) {
    return value;
  }
};

function SkillAssessments() {
  const navigate = useNavigate();
  const { employee, user } = useAuth();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [managerQueue, setManagerQueue] = useState({ items: [], stats: { pending: 0, awaiting_feedback: 0, completed: 0 } });
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackModal, setFeedbackModal] = useState({ open: false, logId: null, employeeName: '', message: '' });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const role = employee?.role || (user?.is_superuser ? 'admin' : null);
  const canProvideFeedback = Boolean(user?.is_superuser || ['manager', 'admin', 'business_partner'].includes(role));

  const loadOverview = useCallback(async () => {
    if (!employee && !user?.is_superuser) {
      setOverview(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params = employee?.employer_id ? { employer_id: employee.employer_id } : {};
      const response = await getSkillReviewOverview(params);
      setOverview(response.data);
    } catch (err) {
      console.error('Не удалось получить обзор по навыкам', err);
      setError('Не удалось загрузить данные. Попробуйте обновить страницу позже.');
    } finally {
      setLoading(false);
    }
  }, [employee, user?.is_superuser]);

  const loadManagerQueue = useCallback(async () => {
    if (!canProvideFeedback) {
      return;
    }
    setQueueLoading(true);
    setQueueError('');
    try {
      const response = await getSkillReviewManagerQueue();
      const data = response.data;
      setManagerQueue({
        items: Array.isArray(data?.items) ? data.items : [],
        stats: data?.stats || { pending: 0, awaiting_feedback: 0, completed: 0 },
      });
    } catch (err) {
      console.error('Не удалось получить очередь фидбеков', err);
      setQueueError('Не удалось загрузить очередь фидбеков.');
      setManagerQueue({ items: [], stats: { pending: 0, awaiting_feedback: 0, completed: 0 } });
    } finally {
      setQueueLoading(false);
    }
  }, [canProvideFeedback]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (canProvideFeedback) {
      loadManagerQueue();
    }
  }, [canProvideFeedback, loadManagerQueue]);

  const timeline = overview?.timeline || [];
  const summary = overview?.summary || {};
  const reputation = overview?.reputation || null;
  const nextReview = overview?.next_review || null;
  const activeReview = overview?.active_review || null;
  const activationDate = overview?.activation_date;
  const scoreTrend = overview?.score_trend || [];

  const trendChartData = useMemo(() => {
    if (!Array.isArray(scoreTrend) || scoreTrend.length === 0) {
      return [];
    }

    const roundTo = (value, precision = 1) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return null;
      }
      const factor = 10 ** precision;
      return Math.round(value * factor) / factor;
    };

    return scoreTrend.map((item) => ({
      period: item.period_label,
      periodId: item.period_id,
      status: item.status,
      selfScore: roundTo(item.self_score, 2),
      peerScore: roundTo(item.peer_score, 2),
      effectiveness: roundTo(item.effectiveness, 1),
    }));
  }, [scoreTrend]);

  const hasTrendData = trendChartData.some(
    (item) => item.selfScore != null || item.peerScore != null || item.effectiveness != null,
  );

  const metrics = useMemo(() => {
    const formatNumber = (value, fallback = '—') => (value != null ? Number(value).toFixed(1) : fallback);
    return {
      selfAvg: formatNumber(summary.self_average),
      peerAvg: formatNumber(summary.peer_average),
      deltaAvg: formatNumber(summary.delta),
      adaptationIndex: formatNumber(summary.adaptation_index),
      completionRate:
        summary.reviews_completion_rate != null ? `${Number(summary.reviews_completion_rate).toFixed(1)}%` : '—',
      punctuality: summary.punctuality_score != null ? Number(summary.punctuality_score).toFixed(1) : '—',
      totalTests: summary.tests_total ?? timeline.length,
      completedTests: summary.tests_completed ?? timeline.filter((item) => item.status === 'completed').length,
      awaitingFeedback: summary.waiting_feedback ?? 0,
      overdue: summary.overdue_reviews ?? 0,
    };
  }, [summary, timeline]);

  const factorChartData = useMemo(() => {
    if (!reputation) {
      return [];
    }
    return [
      {
        factor: 'Пунктуальность',
        score: reputation.factors?.punctuality?.score ?? 0,
      },
      {
        factor: 'Самооценка',
        score: reputation.factors?.self_awareness?.score ?? 0,
      },
      {
        factor: 'Коллаборация',
        score: reputation.factors?.collaboration?.score ?? 0,
      },
    ];
  }, [reputation]);

  const handleOpenReview = (entry) => {
    if (!entry?.token) {
      return;
    }
    navigate(`/reviews/skills/${entry.token}`);
  };

  const openFeedbackModal = (item) => {
    setFeedbackModal({
      open: true,
      logId: item.log_id,
      employeeName: item.employee_name,
      message: '',
    });
    setFeedbackError('');
  };

  const closeFeedbackModal = () => {
    setFeedbackModal({ open: false, logId: null, employeeName: '', message: '' });
    setFeedbackSubmitting(false);
    setFeedbackError('');
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackModal.logId || !feedbackModal.message.trim()) {
      setFeedbackError('Введите текст фидбека.');
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackError('');
    try {
      await submitSkillReviewFeedback({
        log_id: feedbackModal.logId,
        message: feedbackModal.message.trim(),
      });
      closeFeedbackModal();
      await Promise.all([loadManagerQueue(), loadOverview()]);
    } catch (err) {
      console.error('Не удалось отправить фидбек', err);
      setFeedbackError('Не удалось отправить фидбек. Попробуйте позже.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Тесты навыков</h1>
          <p className="page-subtitle">
            Отслеживайте периодические тесты по софт- и хард-скиллам, контролируйте статус прохождения и
            укрепляйте репутацию через своевременные ответы и обратную связь.
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={loadOverview} disabled={loading}>
          Обновить
        </button>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      <section className="page-section">
        <article className="panel">
          <header className="panel-header">
            <div>
              <h2>Личная динамика</h2>
              <span className="panel-subtitle">База активирована {formatDate(activationDate)}</span>
            </div>
            {activeReview?.token && (
              <button type="button" className="btn-primary" onClick={() => handleOpenReview(activeReview)}>
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
              <h3>Оценка коллег</h3>
              <p className="insight-number accent">{metrics.peerAvg}</p>
              <p className="insight-meta">Взвешенное среднее</p>
            </article>
            <article className="insight-card">
              <h3>Δ Peer-Self</h3>
              <p className="insight-number warning">{metrics.deltaAvg}</p>
              <p className="insight-meta">Разница восприятия</p>
            </article>
            <article className="insight-card zone-blue">
              <h3>Индекс адаптации</h3>
              <p className="insight-number">{metrics.adaptationIndex}</p>
              <p className="insight-meta">Комплексный индикатор</p>
            </article>
            <article className="insight-card">
              <h3>Закрыто тестов</h3>
              <p className="insight-number accent">
                {metrics.completedTests}/{metrics.totalTests || '—'}
              </p>
              <p className="insight-meta">Всего по расписанию</p>
            </article>
            <article className="insight-card">
              <h3>Пунктуальность</h3>
              <p className="insight-number">{metrics.punctuality}</p>
              <p className="insight-meta">Индекс дисциплины</p>
            </article>
          </div>

          <div className="summary-strip mt-24">
            <article className="summary-card">
              <h3>Ближайший тест</h3>
              <p className="summary-main">{nextReview ? nextReview.period_label : 'Нет в расписании'}</p>
              {nextReview && (
                <p className="summary-meta">
                  Через {Math.max(nextReview.days_left ?? 0, 0)} дн. · {formatDate(nextReview.due_date)}
                </p>
              )}
            </article>
            <article className="summary-card highlight">
              <h3>Статус расписания</h3>
              <p className="summary-main">
                {metrics.completedTests} выполнено · {metrics.awaitingFeedback} ждут фидбека
              </p>
              <p className="summary-meta">Просрочено: {metrics.overdue}</p>
            </article>
            <article className="summary-card">
              <h3>Выполнение</h3>
              <p className="summary-main">{metrics.completionRate}</p>
              <p className="summary-meta">По всем доступным периодам</p>
            </article>
          </div>

          <div className="score-trend-section mt-24">
            <header className="score-trend-header">
              <div>
                <h3>Динамика оценок</h3>
                <p className="score-trend-meta">Все периодические тесты с учётом самооценки и обратной связи</p>
              </div>
            </header>
            <div className="score-trend-chart">
              {hasTrendData ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={trendChartData} margin={{ top: 10, left: 8, right: 16, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="period" stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} />
                    <YAxis
                      yAxisId="scores"
                      domain={[0, 5]}
                      stroke="var(--text-tertiary)"
                      tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
                      allowDecimals
                    />
                    <YAxis
                      yAxisId="effectiveness"
                      orientation="right"
                      domain={[0, 100]}
                      stroke="var(--text-tertiary)"
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
                      allowDecimals
                    />
                    <Tooltip
                      labelFormatter={(label) => `Период: ${label}`}
                      formatter={(value, name) => {
                        if (value == null) {
                          return ['—', name];
                        }
                        if (name === 'Эффективность') {
                          return [`${Number(value).toFixed(1)}%`, name];
                        }
                        return [Number(value).toFixed(2), name];
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 8 }} />
                    <Line
                      yAxisId="scores"
                      type="monotone"
                      dataKey="selfScore"
                      name="Самооценка"
                      stroke="#3182ce"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="scores"
                      type="monotone"
                      dataKey="peerScore"
                      name="Оценка коллег"
                      stroke="#48bb78"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="effectiveness"
                      type="monotone"
                      dataKey="effectiveness"
                      name="Эффективность"
                      stroke="#ed8936"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty">Недостаточно данных для построения графика динамики.</p>
              )}
            </div>
          </div>

          {reputation && (
            <div className="reputation-section mt-24">
              <article className="reputation-overview">
                <header>
                  <h3>Цифровой отпечаток</h3>
                  <span className="badge">{reputation.overall_score}</span>
                </header>
                <p>{reputation.factors?.punctuality?.description}</p>
                <p>{reputation.factors?.self_awareness?.description}</p>
                <p>{reputation.factors?.collaboration?.description}</p>
              </article>
              <article className="reputation-chart">
                {factorChartData.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={factorChartData} outerRadius="70%">
                      <PolarGrid stroke="var(--border-color)" />
                      <PolarAngleAxis dataKey="factor" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                      <PolarRadiusAxis
                        domain={[0, 100]}
                        tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                        stroke="var(--border-color)"
                      />
                      <Radar
                        name="Оценка"
                        dataKey="score"
                        stroke="var(--color-accent)"
                        fill="var(--color-accent)"
                        fillOpacity={0.45}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty">Недостаточно данных для построения графика.</p>
                )}
              </article>
            </div>
          )}

          <div className="table-wrapper mt-24">
            {loading ? (
              <p className="empty">Обновляем расписание…</p>
            ) : timeline.length === 0 ? (
              <p className="empty">Расписание ещё не сформировано.</p>
            ) : (
              <table className="status-table skill-assessment-table">
                <thead>
                  <tr>
                    <th>Период</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    <th>Балл</th>
                    <th>Воздействие</th>
                    <th>Фидбек</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((entry) => {
                    const isClickable = entry.can_start;
                    return (
                      <tr
                        key={`${entry.period_label}-${entry.due_date}`}
                        className={isClickable ? 'clickable' : ''}
                        onClick={() => (isClickable ? handleOpenReview(entry) : undefined)}
                      >
                        <td>{entry.period_label}</td>
                        <td>{formatDate(entry.due_date)}</td>
                        <td>
                          <span className={`tag status-${entry.status}`}>{statusLabel(entry.status)}</span>
                        </td>
                        <td>{typeof entry.score === 'number' ? entry.score.toFixed(1) : entry.score || '—'}</td>
                        <td className={entry.reputation_penalty > 0 ? 'text-warning' : 'text-secondary'}>
                          {entry.reputation_penalty > 0
                            ? `-${Math.round(entry.reputation_penalty)}`
                            : '0'}
                        </td>
                        <td className="feedback-cell">
                          {entry.feedback?.message ? entry.feedback.message : '—'}
                        </td>
                        <td>
                          {entry.can_start ? (
                            <button type="button" className="btn-secondary" onClick={() => handleOpenReview(entry)}>
                              Пройти
                            </button>
                          ) : entry.feedback?.message ? (
                            <span className="tag muted">Получен фидбек</span>
                          ) : (
                            <span className="tag muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </section>

      {canProvideFeedback && (
        <section className="page-section">
          <article className="panel">
            <header className="panel-header">
              <div>
                <h2>Очередь фидбеков</h2>
                <span className="panel-subtitle">
                  {managerQueue.stats.awaiting_feedback} тест(ов) ждут комментария руководителя
                </span>
              </div>
              <button type="button" className="btn ghost" onClick={loadManagerQueue} disabled={queueLoading}>
                Обновить список
              </button>
            </header>

            {queueError && <div className="page-banner error">{queueError}</div>}

            {queueLoading ? (
              <div className="panel placeholder">Загружаем очередь…</div>
            ) : managerQueue.items.length === 0 ? (
              <p className="empty">Все тесты обработаны. Новых фидбеков не требуется.</p>
            ) : (
              <table className="status-table manager-queue-table">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Период</th>
                    <th>Статус</th>
                    <th>Сдано</th>
                    <th>Дедлайн</th>
                    <th>Просрочка</th>
                    <th>Фидбек</th>
                  </tr>
                </thead>
                <tbody>
                  {managerQueue.items.map((item) => (
                    <tr key={item.log_id}>
                      <td>{item.employee_name}</td>
                      <td>{item.period_label}</td>
                      <td>
                        <span className={`tag status-${item.status}`}>{statusLabel(item.status)}</span>
                      </td>
                      <td>{item.submitted_at ? formatDate(item.submitted_at) : '—'}</td>
                      <td>{formatDate(item.due_date)}</td>
                      <td>{item.days_overdue > 0 ? `${item.days_overdue} дн.` : '—'}</td>
                      <td>
                        {item.status === 'awaiting_feedback' ? (
                          <button type="button" className="btn-primary" onClick={() => openFeedbackModal(item)}>
                            Оставить фидбек
                          </button>
                        ) : item.feedback?.message ? (
                          <span className="tag muted">Отправлен</span>
                        ) : (
                          <span className="tag muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </section>
      )}

      {feedbackModal.open && (
        <div className="modal-backdrop" role="presentation" onClick={closeFeedbackModal}>
          <div className="modal" role="dialog" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h3>Фидбек для {feedbackModal.employeeName}</h3>
            </header>
            <div className="modal-body">
              <label htmlFor="feedback-message">Сообщение</label>
              <textarea
                id="feedback-message"
                rows={6}
                value={feedbackModal.message}
                onChange={(event) =>
                  setFeedbackModal((prev) => ({ ...prev, message: event.target.value }))
                }
              />
              {feedbackError && <p className="modal-error">{feedbackError}</p>}
            </div>
            <footer className="modal-footer">
              <button type="button" className="btn ghost" onClick={closeFeedbackModal} disabled={feedbackSubmitting}>
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmitFeedback}
                disabled={feedbackSubmitting}
              >
                {feedbackSubmitting ? 'Отправляем…' : 'Отправить'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default SkillAssessments;
