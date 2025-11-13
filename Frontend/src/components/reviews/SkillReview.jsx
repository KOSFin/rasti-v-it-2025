import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiSave } from 'react-icons/fi';
import { getReviewFormByToken, submitReviewAnswers } from '../../api/services';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import './ReviewForm.css';

const ANSWER_TYPE_LABELS = {
  scale: 'Шкала',
  numeric: 'Числовой ответ',
  single_choice: 'Выбор варианта',
  boolean: 'Да/Нет',
};

const SkillReview = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const notificationId = searchParams.get('notification_id');
  const navigate = useNavigate();
  const { markAsRead } = useNotifications();
  const { refreshProfile } = useAuth();

  const [payload, setPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [completed, setCompleted] = useState(false);

  const loadForm = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getReviewFormByToken(token);
      const data = response.data;
      setPayload(data);
      setAnswers(extractInitialAnswers(data));
      setCompleted(false);
      setFormError('');
      setSuccessMessage('');

      if (notificationId) {
        markAsRead(notificationId).catch(() => {});
      }
    } catch (fetchError) {
      console.error('Не удалось загрузить форму', fetchError);
      setError('Не удалось загрузить форму оценки. Ссылка могла истечь.');
    } finally {
      setLoading(false);
    }
  }, [token, notificationId, markAsRead]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const groupedQuestions = useMemo(() => {
    if (!payload?.questions) {
      return [];
    }

    return ['hard_skills', 'soft_skills']
      .map((key) => payload.questions[key] || [])
      .flat();
  }, [payload]);

  const allQuestions = useMemo(
    () => groupedQuestions.flatMap((group) => group.items),
    [groupedQuestions],
  );

  const updateAnswer = useCallback((questionId, patch) => {
    setAnswers((prev) => {
      const previous = prev[questionId] || { grade: '', value: null };
      const next = { ...previous, ...patch };
      return { ...prev, [questionId]: next };
    });
  }, []);

  const handleScaleChange = (questionId, grade) => {
    updateAnswer(questionId, { grade: grade === '' ? '' : Number(grade) });
  };

  const handleNumericChange = (questionId, value) => {
    updateAnswer(questionId, { value });
  };

  const handleSingleChoiceChange = (questionId, value) => {
    updateAnswer(questionId, { value });
  };

  const handleBooleanSet = (questionId, value) => {
    updateAnswer(questionId, { value });
  };

  const isQuestionAnswered = (question, entry) => {
    if (!entry) {
      return false;
    }
    switch (question.answer_type) {
      case 'scale':
        return entry.grade !== '' && entry.grade !== null && entry.grade !== undefined;
      case 'numeric':
        return entry.value !== '' && entry.value !== null && entry.value !== undefined;
      case 'single_choice':
        return entry.value !== '' && entry.value !== null && entry.value !== undefined;
      case 'boolean':
        return typeof entry.value === 'boolean';
      default:
        return (
          (entry.grade !== '' && entry.grade !== null && entry.grade !== undefined) ||
          (entry.value !== '' && entry.value !== null && entry.value !== undefined)
        );
    }
  };

  const renderAnswerControl = (item) => {
    const entry = answers[item.id] || { grade: '', value: null };
    const isDisabled = submitting || completed;

    if (item.answer_type === 'scale') {
      const min = Number.isFinite(item.scale_min) ? item.scale_min : 0;
      const max =
        Number.isFinite(item.scale_max) && item.scale_max >= min ? item.scale_max : Math.max(min + 10, 10);
      const range = [];
      for (let value = min; value <= max; value += 1) {
        range.push(value);
      }
      const selectValue =
        entry.grade === '' || entry.grade === null || entry.grade === undefined ? '' : String(entry.grade);
      return (
        <select
          value={selectValue}
          onChange={(event) => handleScaleChange(item.id, event.target.value)}
          disabled={isDisabled}
        >
          <option value="">Не выбрано</option>
          {range.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
      );
    }

    if (item.answer_type === 'numeric') {
      const numericValue = entry.value === null || entry.value === undefined ? '' : String(entry.value);
      return (
        <input
          type="number"
          step="0.1"
          value={numericValue}
          onChange={(event) => handleNumericChange(item.id, event.target.value)}
          placeholder="Ответ"
          disabled={isDisabled}
        />
      );
    }

    if (item.answer_type === 'single_choice') {
      const current = entry.value === null || entry.value === undefined ? '' : String(entry.value);
      return (
        <select
          value={current}
          onChange={(event) => handleSingleChoiceChange(item.id, event.target.value)}
          disabled={isDisabled}
        >
          <option value="">Выберите вариант</option>
          {(item.answer_options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (item.answer_type === 'boolean') {
      const currentValue = entry.value;
      return (
        <div className="boolean-toggle">
          <button
            type="button"
            className={currentValue === true ? 'active' : ''}
            onClick={() => handleBooleanSet(item.id, true)}
            disabled={isDisabled}
          >
            Да
          </button>
          <button
            type="button"
            className={currentValue === false ? 'active' : ''}
            onClick={() => handleBooleanSet(item.id, false)}
            disabled={isDisabled}
          >
            Нет
          </button>
          <button
            type="button"
            className={!currentValue && currentValue !== false ? 'muted' : 'ghost'}
            onClick={() => handleBooleanSet(item.id, null)}
            disabled={isDisabled}
          >
            Сброс
          </button>
        </div>
      );
    }

    const fallbackValue = entry.value === null || entry.value === undefined ? '' : String(entry.value);
    return (
      <input
        type="text"
        value={fallbackValue}
        onChange={(event) => updateAnswer(item.id, { value: event.target.value })}
        disabled={isDisabled}
      />
    );
  };

  const handleSubmit = async (mode = 'full') => {
    if (completed) {
      return;
    }

    setSubmitting(true);
    setFormError('');
    setSuccessMessage('');

    const entries = [];
    allQuestions.forEach((question) => {
      const entry = answers[question.id];
      if (!entry) {
        return;
      }

      const payloadRow = { id_question: Number(question.id) };

      switch (question.answer_type) {
        case 'scale':
          if (entry.grade !== '' && entry.grade !== null && entry.grade !== undefined) {
            payloadRow.grade = Number(entry.grade);
          }
          break;
        case 'numeric':
          if (entry.value !== '' && entry.value !== null && entry.value !== undefined) {
            const numericValue = Number(entry.value);
            if (!Number.isNaN(numericValue)) {
              payloadRow.answer = numericValue;
            }
          }
          if (entry.grade !== '' && entry.grade !== null && entry.grade !== undefined) {
            payloadRow.grade = Number(entry.grade);
          }
          break;
        case 'single_choice':
          if (entry.value !== '' && entry.value !== null && entry.value !== undefined) {
            payloadRow.answer = entry.value;
          }
          break;
        case 'boolean':
          if (typeof entry.value === 'boolean') {
            payloadRow.answer = entry.value;
          }
          break;
        default:
          if (entry.value !== '' && entry.value !== null && entry.value !== undefined) {
            payloadRow.answer = entry.value;
          }
          if (entry.grade !== '' && entry.grade !== null && entry.grade !== undefined) {
            payloadRow.grade = Number(entry.grade);
          }
          break;
      }

      if ('answer' in payloadRow || 'grade' in payloadRow) {
        entries.push(payloadRow);
      }
    });

    if (mode === 'full') {
      const missing = allQuestions.filter((question) => !isQuestionAnswered(question, answers[question.id]));
      if (missing.length > 0) {
        setFormError('Ответьте на все вопросы перед отправкой формы.');
        setSubmitting(false);
        return;
      }
    }

    if (!entries.length) {
      setFormError('Нет ответов для отправки. Оцените хотя бы один вопрос.');
      setSubmitting(false);
      return;
    }

    try {
      await submitReviewAnswers({ token, answers: entries, save_mode: mode });

      if (mode === 'full') {
        setSuccessMessage('Ответы успешно отправлены.');
        setCompleted(true);
        try {
          await refreshProfile();
        } catch (profileError) {
          console.warn('Не удалось обновить профиль после отправки самооценки', profileError);
        }
      } else {
        setSuccessMessage('Черновик сохранён. Вы можете вернуться позже.');
      }
    } catch (submitError) {
      console.error('Не удалось отправить ответы', submitError);
      const status = submitError?.response?.status;
      const resp = submitError?.response?.data;
      const serverMessage = resp?.message || resp?.detail || (typeof resp === 'string' ? resp : null);

      if (status && [404, 409, 410].includes(status)) {
        setError(serverMessage || 'Форма больше недоступна или уже была заполнена.');
      } else {
        setFormError(
          serverMessage || 'Не удалось отправить ответы. Проверьте подключение и попробуйте снова.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="review-page loading">
        <div className="spinner" aria-hidden="true" />
        <span>Загружаем форму оценки…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="review-page error">
        <p>{error}</p>
        <button type="button" onClick={() => navigate(-1)} className="ghost-btn">
          <FiArrowLeft size={16} />
          <span>Вернуться назад</span>
        </button>
      </div>
    );
  }

  if (!payload) {
    return null;
  }

  const reviewTypeLabel = payload.review_type === 'self' ? 'Self' : 'Peer';

  return (
    <div className="review-page">
      <header className="review-header">
        <button type="button" className="ghost-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft size={16} />
          <span>Назад</span>
        </button>
        <div className="review-header-meta">
          <h1>{payload.review_type === 'self' ? 'Самооценка навыков' : 'Оценка коллеги'}</h1>
          <p>
            {payload.employer?.fio} • {payload.review_period}
          </p>
        </div>
      </header>

      {successMessage && <div className="review-alert success">{successMessage}</div>}
      {formError && <div className="review-alert error">{formError}</div>}

      <section className="review-card">
        {groupedQuestions.length === 0 && <p className="muted">Нет вопросов для оценки.</p>}

        {groupedQuestions.map((group) => (
          <article key={group.category} className="review-group">
            <header>
              <h2>{group.category}</h2>
              <span>{reviewTypeLabel}</span>
            </header>
            <ul>
              {group.items.map((item) => (
                <li key={item.id} className={`review-question answer-type-${item.answer_type}`}>
                  <div className="question-content">
                    <p className="question-title">{item.question}</p>
                    {item.grade_description && (
                      <p className="question-description">{item.grade_description}</p>
                    )}
                    <div className="question-badges">
                      <span className="question-badge">
                        {ANSWER_TYPE_LABELS[item.answer_type] || 'Ответ'}
                      </span>
                      <span className="question-badge muted">Вес {item.weight ?? 1}</span>
                      {item.difficulty && (
                        <span className="question-badge muted">Сложность: {item.difficulty}</span>
                      )}
                      {item.answer_type === 'scale' && (
                        <span className="question-badge muted">
                          Диапазон {item.scale_min} – {item.scale_max}
                        </span>
                      )}
                      {item.answer_type === 'numeric' && (
                        <span className="question-badge muted">
                          Допуск ±{Number(item.tolerance ?? 0)}
                        </span>
                      )}
                    </div>
                    {item.answer_type === 'single_choice' && Array.isArray(item.answer_options) && (
                      <div className="answer-options">
                        {item.answer_options.map((option) => (
                          <span key={option} className="answer-chip">
                            {option}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grade-control">{renderAnswerControl(item)}</div>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <footer className="review-actions">
        {!completed && (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => handleSubmit('partial')}
            disabled={submitting}
          >
            <FiSave size={16} />
            <span>Сохранить черновик</span>
          </button>
        )}
        <button
          type="button"
          className="primary-btn"
          onClick={() => handleSubmit('full')}
          disabled={submitting || completed}
        >
          <FiCheck size={16} />
          <span>{completed ? 'Ответы отправлены' : 'Отправить ответы'}</span>
        </button>
      </footer>
    </div>
  );
};

function extractInitialAnswers(data) {
  if (!data?.questions) {
    return {};
  }

  const result = {};
  ['hard_skills', 'soft_skills'].forEach((key) => {
    const groups = data.questions[key] || [];
    groups.forEach((group) => {
      group.items.forEach((item) => {
        const rawValue = getRawAnswerValue(item.answer_value);
        switch (item.answer_type) {
          case 'scale':
            result[item.id] = {
              grade: typeof item.grade === 'number' ? item.grade : '',
              value: null,
            };
            break;
          case 'numeric':
            result[item.id] = {
              grade: typeof item.grade === 'number' ? item.grade : null,
              value:
                rawValue === null || rawValue === undefined || Number.isNaN(Number(rawValue))
                  ? ''
                  : String(rawValue),
            };
            break;
          case 'single_choice':
            result[item.id] = {
              grade: typeof item.grade === 'number' ? item.grade : null,
              value: rawValue != null ? String(rawValue) : '',
            };
            break;
          case 'boolean':
            result[item.id] = {
              grade: typeof item.grade === 'number' ? item.grade : null,
              value: normalizeBoolean(rawValue),
            };
            break;
          default:
            result[item.id] = {
              grade: typeof item.grade === 'number' ? item.grade : null,
              value: rawValue ?? null,
            };
        }
      });
    });
  });
  return result;
}

function getRawAnswerValue(answerValue) {
  if (answerValue && typeof answerValue === 'object') {
    if ('raw' in answerValue) {
      return answerValue.raw;
    }
    if ('value' in answerValue) {
      return answerValue.value;
    }
  }
  return answerValue ?? null;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === '1' || value === 1) {
    return true;
  }
  if (value === 'false' || value === '0' || value === 0) {
    return false;
  }
  return null;
}

export default SkillReview;
