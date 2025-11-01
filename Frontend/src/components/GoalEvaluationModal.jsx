import { useEffect, useMemo, useState } from 'react';
import './GoalEvaluationModal.css';

const DEFAULT_FORM = {
  results_achievement: 5,
  collaboration_quality: 5,
  personal_qualities: '',
  improvements_suggested: '',
};

const gradeOptions = Array.from({ length: 11 }, (_, index) => index);

const GoalEvaluationModal = ({ goal, notification, saving = false, error = '', onSubmit, onClose }) => {
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    setForm(DEFAULT_FORM);
  }, [goal?.id]);

  const completedTasks = useMemo(() => {
    if (!goal?.tasks) {
      return [];
    }
    return goal.tasks.filter((task) => task.is_completed);
  }, [goal?.tasks]);

  const handleChange = (event) => {
    const { name, value, type } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!goal?.id || !onSubmit) {
      return;
    }

    onSubmit({
      ...form,
      results_achievement: Number(form.results_achievement),
      collaboration_quality: Number(form.collaboration_quality),
    });
  };

  if (!goal) {
    return null;
  }

  const employeeName = goal.employee_name || notification?.goal_employee_name;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal goal-evaluation-modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2>Оценка достижения цели</h2>
          <p className="modal-subtitle">{goal.title}</p>
        </header>
        <form className="modal-body goal-evaluation-body" onSubmit={handleSubmit}>
          <div className="goal-evaluation-intro">
            <p>
              Поделитесь наблюдениями о результате и поведении коллеги. Ответы увидят только менеджер и HR.
            </p>
            <div className="goal-evaluation-meta">
              {employeeName && <span>Сотрудник: {employeeName}</span>}
              {notification?.department_name && <span>Отдел: {notification.department_name}</span>}
            </div>
          </div>

          {completedTasks.length > 0 && (
            <div className="goal-evaluation-tasks">
              <h3>Завершённые задачи</h3>
              <ul>
                {completedTasks.map((task) => (
                  <li key={task.id}>{task.title}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="goal-evaluation-ratings">
            <label>
              <span>Достижение результатов *</span>
              <select
                name="results_achievement"
                value={form.results_achievement}
                onChange={handleChange}
              >
                {gradeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Качество сотрудничества *</span>
              <select
                name="collaboration_quality"
                value={form.collaboration_quality}
                onChange={handleChange}
              >
                {gradeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="goal-evaluation-field">
            <span>Личные качества *</span>
            <textarea
              name="personal_qualities"
              value={form.personal_qualities}
              onChange={handleChange}
              rows={3}
              placeholder="Опишите сильные стороны и проявленные качества"
              required
            />
          </label>

          <label className="goal-evaluation-field">
            <span>Рекомендации по развитию *</span>
            <textarea
              name="improvements_suggested"
              value={form.improvements_suggested}
              onChange={handleChange}
              rows={3}
              placeholder="Что можно улучшить или продолжить развивать?"
              required
            />
          </label>

          {error && <div className="goal-evaluation-error">{error}</div>}

          <footer className="modal-footer">
            <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
              Отменить
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Отправляем…' : 'Отправить оценку'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default GoalEvaluationModal;
