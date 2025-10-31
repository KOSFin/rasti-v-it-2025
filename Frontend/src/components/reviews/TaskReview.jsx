import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { getTaskReviewForm, submitTaskReview } from '../../api/services';
import { useNotifications } from '../../contexts/NotificationContext';
import './ReviewForm.css';

const gradeOptions = Array.from({ length: 11 }, (_, index) => index);

const TaskReview = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const notificationId = searchParams.get('notification_id');
  const navigate = useNavigate();
  const { markAsRead } = useNotifications();

  const [payload, setPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadForm = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getTaskReviewForm(token);
      const data = response.data;
      setPayload(data);
      setAnswers(extractInitialAnswers(data));

      if (notificationId) {
        markAsRead(notificationId).catch(() => {});
      }
    } catch (fetchError) {
      console.error('Не удалось загрузить форму задачи', fetchError);
      setError('Не удалось загрузить форму оценки задачи. Проверьте ссылку.');
    } finally {
      setLoading(false);
    }
  }, [token, notificationId, markAsRead]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const categories = useMemo(() => payload?.questions || [], [payload]);

  const handleGradeChange = (questionId, grade) => {
    setAnswers((prev) => ({ ...prev, [questionId]: Number(grade) }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSuccessMessage('');

    try {
      const result = await submitTaskReview({
        token,
        answers: Object.entries(answers).map(([questionId, grade]) => ({
          id_question: questionId,
          grade: Number(grade ?? 0),
        })),
      });

      if (result?.data?.review_completed) {
        setSuccessMessage('Ответы отправлены. Задача переведена в завершённые.');
      } else {
        setSuccessMessage('Ответы отправлены. Ожидаются оценки других участников.');
      }
    } catch (submitError) {
      console.error('Не удалось отправить оценки по задаче', submitError);
      setError('Не удалось отправить ответы. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="review-page loading">
        <div className="spinner" aria-hidden="true" />
        <span>Загружаем форму задачи…</span>
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

  const { task, review } = payload;

  return (
    <div className="review-page">
      <header className="review-header">
        <button type="button" className="ghost-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft size={16} />
          <span>Назад</span>
        </button>
        <div className="review-header-meta">
          <h1>Оценка задачи</h1>
          <p>
            {task?.title} • {task?.end_date && new Date(task.end_date).toLocaleDateString('ru-RU')}
          </p>
        </div>
      </header>

      {successMessage && <div className="review-alert success">{successMessage}</div>}

      <section className="review-card">
        <article className="review-group">
          <header>
            <h2>Описание задачи</h2>
            <span>{review?.type === 'self' ? 'Self' : 'Peer'}</span>
          </header>
          <p className="muted">{task?.description || 'Нет описания задачи.'}</p>
        </article>

        {categories.length === 0 && <p className="muted">Вопросы для оценки отсутствуют.</p>}

        {categories.map((category) => (
          <article key={category.category} className="review-group">
            <header>
              <h2>{category.category}</h2>
            </header>
            <ul>
              {category.items.map((item) => (
                <li key={item.id}>
                  <div>
                    <p>{item.text}</p>
                  </div>
                  <div className="grade-control">
                    <select
                      value={answers[item.id] ?? 0}
                      onChange={(event) => handleGradeChange(item.id, event.target.value)}
                    >
                      {gradeOptions.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <footer className="review-actions">
        <button type="button" className="primary-btn" onClick={handleSubmit} disabled={submitting}>
          <FiCheck size={16} />
          <span>Отправить ответы</span>
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
  data.questions.forEach((category) => {
    category.items.forEach((item) => {
      result[item.id] = item.grade ?? 0;
    });
  });
  return result;
}

export default TaskReview;
