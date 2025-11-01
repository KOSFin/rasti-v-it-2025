import { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiUsers, FiTarget, FiSend, FiCheckCircle } from 'react-icons/fi';
import {
  getPendingFeedback360,
  getFeedback360ForMe,
  getFeedback360List,
  getGoals,
  createFeedback360,
} from '../api/services';
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

const DEFAULT_FORM = {
  employee: '',
  goal: '',
  results_achievement: 5,
  personal_qualities: '',
  collaboration_quality: 5,
  improvements_suggested: '',
};

function Feedback360() {
  const [pendingEvaluations, setPendingEvaluations] = useState([]);
  const [feedbackAboutMe, setFeedbackAboutMe] = useState([]);
  const [feedbackIGave, setFeedbackIGave] = useState([]);
  const [completedGoals, setCompletedGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [pendingRes, forMeRes, goalsRes, givenRes] = await Promise.all([
        getPendingFeedback360(), // Это вернет уведомления
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

  const handleChange = (event) => {
    const { name, value, type } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.employee || !formData.goal) {
      setError('Выберите сотрудника и цель.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...formData,
        employee: Number(formData.employee),
        goal: Number(formData.goal),
        results_achievement: Number(formData.results_achievement),
        collaboration_quality: Number(formData.collaboration_quality),
      };
      
      await createFeedback360(payload);
      setFormData(DEFAULT_FORM);
      setShowForm(false);
      await loadData();
    } catch (err) {
      console.error('Не удалось отправить оценку', err);
      const errorMessage = err.response?.data?.employee?.[0] 
        || err.response?.data?.goal?.[0]
        || err.response?.data?.error 
        || err.response?.data?.detail 
        || 'Не удалось отправить оценку. Попробуйте позже.';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Обратная связь 360°</h1>
          <p className="page-subtitle">Получайте и давайте развивающую обратную связь коллегам</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn primary" onClick={() => setShowForm((prev) => !prev)}>
            <FiPlus size={16} /> {showForm ? 'Скрыть форму' : 'Новая оценка'}
          </button>
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

      {showForm && (
        <section className="panel">
          <header className="panel-header">
            <h2>Заполнить оценку</h2>
            <span>Выберите коллегу и задачу, чтобы оставить обратную связь</span>
          </header>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Коллега *</span>
              <select name="employee" value={formData.employee} onChange={handleChange} required>
                <option value="">Выберите коллегу</option>
                {pendingEvaluations.map((notif) => (
                  <option key={notif.goal} value={notif.goal_employee_name}>
                    {notif.goal_employee_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Цель *</span>
              <select name="goal" value={formData.goal} onChange={handleChange} required>
                <option value="">Выберите цель</option>
                {completedGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title} — {goal.employee_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Достижение результатов *</span>
              <input
                type="number"
                min={0}
                max={10}
                name="results_achievement"
                value={formData.results_achievement}
                onChange={handleChange}
                required
              />
              <small>Баллы от 0 до 10</small>
            </label>
            <label className="form-field">
              <span>Качество сотрудничества *</span>
              <input
                type="number"
                min={0}
                max={10}
                name="collaboration_quality"
                value={formData.collaboration_quality}
                onChange={handleChange}
                required
              />
              <small>Баллы от 0 до 10</small>
            </label>
            <label className="form-field span-2">
              <span>Личные качества *</span>
              <textarea
                name="personal_qualities"
                value={formData.personal_qualities}
                onChange={handleChange}
                rows={3}
                placeholder="Опишите сильные стороны и поведение коллеги"
                required
              />
            </label>
            <label className="form-field span-2">
              <span>Рекомендации по развитию *</span>
              <textarea
                name="improvements_suggested"
                value={formData.improvements_suggested}
                onChange={handleChange}
                rows={3}
                placeholder="Что поможет коллегe развиваться дальше?"
                required
              />
            </label>
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>
                Отменить
              </button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Отправляем…' : 'Отправить оценку'}
              </button>
            </div>
          </form>
        </section>
      )}

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
                    <button type="button" className="btn ghost" onClick={() => {
                      setFormData((prev) => ({ ...prev, goal: notif.goal, employee: notif.goal?.employee }));
                      setShowForm(true);
                    }}>
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
    </div>
  );
}

export default Feedback360;
