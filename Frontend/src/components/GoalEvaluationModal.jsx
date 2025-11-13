import { useEffect, useMemo, useState } from 'react';
import { getAssessmentQuestionBank } from '../api/services';
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
  const [objectiveQuestions, setObjectiveQuestions] = useState([]);
  const [objectiveAnswers, setObjectiveAnswers] = useState({});
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState('');

  useEffect(() => {
    setForm(DEFAULT_FORM);
    setObjectiveAnswers({});
    setObjectiveQuestions([]);
    setQuestionsError('');
  }, [goal?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadQuestions = async () => {
      if (!goal?.id) {
        setObjectiveQuestions([]);
        setObjectiveAnswers({});
        return;
      }

      setQuestionsLoading(true);
      setQuestionsError('');

      try {
        const params = { context: 'feedback_360' };
        if (goal?.department_id) {
          params.department = goal.department_id;
        }
        const response = await getAssessmentQuestionBank(params);
        const list = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.results)
          ? response.data.results
          : [];

        if (!cancelled) {
          setObjectiveQuestions(list);
          const defaults = {};
          list.forEach((question) => {
            if (question.answer_type === 'scale') {
              const max = Number(question.max_score || 10);
              defaults[question.id] = Math.round(max / 2);
            } else if (question.answer_type === 'numeric') {
              defaults[question.id] = '';
            } else if (question.answer_type === 'boolean') {
              defaults[question.id] = false;
            } else {
              defaults[question.id] = '';
            }
          });
          setObjectiveAnswers(defaults);
        }
      } catch (err) {
        console.error('Не удалось загрузить вопросы для оценки 360', err);
        if (!cancelled) {
          setObjectiveQuestions([]);
          setObjectiveAnswers({});
          setQuestionsError('Не удалось загрузить пакет объективных вопросов.');
        }
      } finally {
        if (!cancelled) {
          setQuestionsLoading(false);
        }
      }
    };

    loadQuestions();

    return () => {
      cancelled = true;
    };
  }, [goal?.id, goal?.department_id]);

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

    const objectivePayload = objectiveQuestions.map((question) => ({
      question_id: question.id,
      answer: formatObjectiveAnswer(question, objectiveAnswers[question.id]),
    }));

    onSubmit({
      ...form,
      results_achievement: Number(form.results_achievement),
      collaboration_quality: Number(form.collaboration_quality),
      objective_answers: objectivePayload,
      department_id: goal?.department_id || '',
    });
  };

  if (!goal) {
    return null;
  }

  const employeeName = goal.employee_name || notification?.goal_employee_name;
  const objectiveSummary = useMemo(() => {
    if (!objectiveQuestions.length) {
      return [];
    }
    return objectiveQuestions.map((question) => ({
      id: question.id,
      title: question.title,
      type: question.answer_type,
      max: Number(question.max_score || 10),
      options: question.answer_options || [],
      value: objectiveAnswers[question.id],
    }));
  }, [objectiveQuestions, objectiveAnswers]);

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

          {questionsError && <div className="goal-objective-error">{questionsError}</div>}

          {questionsLoading ? (
            <div className="goal-objective-loading">Подготовка объективных вопросов…</div>
          ) : (
            objectiveSummary.length > 0 && (
              <div className="goal-objective-block">
                <h3>Объективный блок 360°</h3>
                <p className="goal-objective-hint">
                  Ответы на эти вопросы позволяют сравнивать отделы между собой и показывать данные на графиках без дополнительной обработки.
                </p>
                <div className="goal-objective-grid">
                  {objectiveSummary.map((question) => (
                    <div key={question.id} className="goal-objective-card">
                      <header>
                        <strong>{question.title}</strong>
                        <span className="tag muted">{renderQuestionType(question.type)}</span>
                      </header>
                      {renderObjectiveControl({
                        question,
                        value: objectiveAnswers[question.id],
                        onChange: (value) =>
                          setObjectiveAnswers((prev) => ({
                            ...prev,
                            [question.id]: value,
                          })),
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )
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

function renderQuestionType(type) {
  switch (type) {
    case 'scale':
      return 'Шкала';
    case 'numeric':
      return 'Числовой ответ';
    case 'single_choice':
      return 'Выбор варианта';
    case 'boolean':
      return 'Да / Нет';
    default:
      return 'Вопрос';
  }
}

function renderObjectiveControl({ question, value, onChange }) {
  if (question.type === 'scale') {
    const max = Number.isFinite(question.max) ? question.max : 10;
    const safeValue = Number.isFinite(value) ? value : Math.round(max / 2);
    return (
      <div className="goal-objective-control slider">
        <input
          type="range"
          min="0"
          max={max}
          step="1"
          value={safeValue}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="slider-value">{safeValue} из {max}</span>
      </div>
    );
  }

  if (question.type === 'numeric') {
    return (
      <div className="goal-objective-control">
        <input
          type="number"
          value={value === '' ? '' : Number(value)}
          placeholder="Введите точный ответ"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (question.type === 'single_choice') {
    return (
      <div className="goal-objective-control choices">
        {(question.options || []).map((option) => (
          <label key={option} className="goal-objective-radio">
            <input
              type="radio"
              name={`goal-objective-${question.id}`}
              value={option}
              checked={value === option}
              onChange={(event) => onChange(event.target.value)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'boolean') {
    return (
      <label className="goal-objective-control boolean">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{Boolean(value) ? 'Да' : 'Нет'}</span>
      </label>
    );
  }

  return (
    <div className="goal-objective-control">
      <input
        type="text"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function formatObjectiveAnswer(question, rawValue) {
  if (question.answer_type === 'scale' || question.answer_type === 'numeric') {
    const numeric = Number(rawValue);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (question.answer_type === 'boolean') {
    return Boolean(rawValue);
  }
  return rawValue ?? '';
}
