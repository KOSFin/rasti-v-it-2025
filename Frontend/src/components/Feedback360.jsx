import { useEffect, useMemo, useState } from 'react';
import { FiUsers, FiTarget, FiSend, FiCheckCircle } from 'react-icons/fi';
import {
  getPendingFeedback360,
  getFeedback360ForMe,
  getFeedback360List,
  getGoals,
  getGoal,
  createFeedback360,
} from '../api/services';
import './Common.css';
import GoalEvaluationModal from './GoalEvaluationModal';

const extractResults = (response) => {
  if (!response?.data) {
    return [];
  }
  if (Array.isArray(response.data?.results)) {
    return response.data.results;
  }
  return Array.isArray(response.data) ? response.data : response.data?.results || [];
};

function Feedback360() {
  const [pendingEvaluations, setPendingEvaluations] = useState([]);
  const [feedbackAboutMe, setFeedbackAboutMe] = useState([]);
  const [feedbackIGave, setFeedbackIGave] = useState([]);
  const [completedGoals, setCompletedGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeEvaluation, setActiveEvaluation] = useState(null);
  const [evaluationError, setEvaluationError] = useState('');
  const [savingEvaluation, setSavingEvaluation] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [pendingRes, forMeRes, goalsRes, givenRes] = await Promise.all([
        getPendingFeedback360(), 
        getFeedback360ForMe(),
        getGoals({ page_size: 200, is_completed: true, evaluation_launched: true }),
        getFeedback360List({ page_size: 200, ordering: '-created_at' }),
      ]);

      setPendingEvaluations(Array.isArray(pendingRes?.data) ? pendingRes.data : extractResults(pendingRes));
      setFeedbackAboutMe(Array.isArray(forMeRes?.data) ? forMeRes.data : extractResults(forMeRes));
      setCompletedGoals(extractResults(goalsRes));
      setFeedbackIGave(extractResults(givenRes));
    } catch (err) {
      console.error('Не удалось загрузить данные 360', err);
      setError('Не удалось загрузить данные. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const metrics = useMemo(() => {
    const avgScore = feedbackAboutMe.length
      ? (feedbackAboutMe.reduce((acc, item) => acc + (item.calculated_score || 0), 0) / feedbackAboutMe.length).toFixed(1)
      : '0.0';

    return {
      pending: pendingEvaluations.length,
      received: feedbackAboutMe.length,
      sent: feedbackIGave.length,
      averageScore: avgScore,
    };
  }, [pendingEvaluations, feedbackAboutMe, feedbackIGave]);

  const goalById = useMemo(() => {
    return completedGoals.reduce((acc, goal) => {
      acc[goal.id] = goal;
      return acc;
    }, {});
  }, [completedGoals]);

  const handleOpenEvaluation = async (notification) => {
    if (!notification) {
      return;
    }

    setError('');
    setEvaluationError('');

    const goalId = notification.goal || notification.goal_id;
    let goal = goalId ? goalById[goalId] : null;

    if (!goal && notification.goal_details) {
      goal = notification.goal_details;
    }

    if ((!goal || !goal.employee) && goalId) {
      try {
        const response = await getGoal(goalId);
        goal = response?.data;
        if (goal) {
          setCompletedGoals((prev) => {
            if (prev.some((item) => item.id === goal.id)) {
              return prev;
            }
            return [...prev, goal];
          });
        }
      } catch (err) {
        console.error('Не удалось получить данные цели для оценки', err);
        setError('Не удалось загрузить данные цели. Попробуйте позже.');
        return;
      }
    }

    if (!goal) {
      setError('Не удалось найти данные цели. Обновите страницу и попробуйте снова.');
      return;
    }

    setActiveEvaluation({ goal, notification });
  };

  const handleCloseEvaluation = () => {
    setActiveEvaluation(null);
    setEvaluationError('');
    setSavingEvaluation(false);
  };

  const handleSubmitEvaluation = async (values) => {
    if (!activeEvaluation?.goal) {
      return;
    }

    setSavingEvaluation(true);
    setEvaluationError('');

    try {
      await createFeedback360({
        ...values,
        employee: activeEvaluation.goal.employee,
        goal: activeEvaluation.goal.id,
      });
      setActiveEvaluation(null);
      await loadData();
    } catch (err) {
      console.error('Не удалось отправить оценку', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Не удалось отправить оценку. Попробуйте позже.';
      setEvaluationError(errorMessage);
    } finally {
      setSavingEvaluation(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Обратная связь 360°</h1>
          <p className="page-subtitle">Получайте и давайте развивающую обратную связь коллегам</p>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      <section className="insights-grid">
        <article className="insight-card">
          <h3>Нужно оценить</h3>
          <p className="insight-number warning">{metrics.pending}</p>
          <p className="insight-meta">Коллег ожидают обратной связи</p>
        </article>
        <article className="insight-card">
          <h3>Получено</h3>
          <p className="insight-number accent">{metrics.received}</p>
          <p className="insight-meta">Средний балл {metrics.averageScore}</p>
        </article>
        <article className="insight-card">
          <h3>Отправлено</h3>
          <p className="insight-number success">{metrics.sent}</p>
          <p className="insight-meta">Оценок коллегам за период</p>
        </article>
      </section>

      <section className="page-section feedback-layout">
        {loading ? (
          <div className="panel placeholder">Загружаем оценки…</div>
        ) : (
          <>
            <article className="panel">
              <header className="panel-header">
                <h2>
                  <FiUsers size={18} /> Ожидают вашей оценки
                </h2>
                <span>{pendingEvaluations.length}</span>
              </header>
              <ul className="list">
                {pendingEvaluations.length === 0 && <li className="empty">Все цели коллег уже оценены</li>}
                {pendingEvaluations.map((notif) => (
                  <li key={notif.id}>
                    <div>
                      <strong>{notif.goal_employee_name}</strong>
                      <span>{notif.goal_title}</span>
                      {notif.department_name && <span className="tag muted">{notif.department_name}</span>}
                    </div>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => handleOpenEvaluation(notif)}
                    >
                      Оценить
                    </button>
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel">
              <header className="panel-header">
                <h2>
                  <FiTarget size={18} /> Оценки о вас
                </h2>
                <span>{feedbackAboutMe.length}</span>
              </header>
              <ul className="list detailed">
                {feedbackAboutMe.length === 0 && <li className="empty">Пока нет оценок</li>}
                {feedbackAboutMe.map((feedback) => (
                  <li key={feedback.id}>
                    <div>
                      <strong>{feedback.assessor_name}</strong>
                      <span>{feedback.goal_title}</span>
                      {feedback.goal_tasks && feedback.goal_tasks.length > 0 && (
                        <div className="tasks-preview">
                          <small>Задачи:</small>
                          <ul>
                            {feedback.goal_tasks.filter(t => t.is_completed).map(task => (
                              <li key={task.id}>
                                <FiCheckCircle size={12} /> {task.title}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="tag-group">
                      <span className="tag accent">Итог {feedback.calculated_score}</span>
                      <span className="tag">Результат {feedback.results_achievement}/10</span>
                      <span className="tag">Сотрудничество {feedback.collaboration_quality}/10</span>
                      <span className="tag muted">{new Date(feedback.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel">
              <header className="panel-header">
                <h2>
                  <FiSend size={18} /> Ваши оценки
                </h2>
                <span>{feedbackIGave.length}</span>
              </header>
              <ul className="list detailed">
                {feedbackIGave.length === 0 && <li className="empty">Вы ещё не отправляли оценки</li>}
                {feedbackIGave.map((feedback) => (
                  <li key={feedback.id}>
                    <div>
                      <strong>{feedback.employee_name}</strong>
                      <span>{feedback.goal_title}</span>
                    </div>
                    <div className="tag-group">
                      <span className="tag accent">{feedback.calculated_score} баллов</span>
                      <span className="tag muted">{new Date(feedback.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </>
        )}
      </section>

      {activeEvaluation?.goal && (
        <GoalEvaluationModal
          goal={activeEvaluation.goal}
          notification={activeEvaluation.notification}
          saving={savingEvaluation}
          error={evaluationError}
          onSubmit={handleSubmitEvaluation}
          onClose={handleCloseEvaluation}
        />
      )}
    </div>
  );
}

export default Feedback360;
