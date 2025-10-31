import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiSave } from 'react-icons/fi';
import { getReviewFormByToken, submitReviewAnswers } from '../../api/services';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import './ReviewForm.css';

const gradeOptions = Array.from({ length: 11 }, (_, index) => index);

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
  const [successMessage, setSuccessMessage] = useState('');

  const loadForm = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getReviewFormByToken(token);
      const data = response.data;
      setPayload(data);
      setAnswers(extractInitialAnswers(data));

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

  const handleGradeChange = (questionId, grade) => {
    setAnswers((prev) => ({ ...prev, [questionId]: Number(grade) }));
  };

  const handleSubmit = async (mode = 'full') => {
    setSubmitting(true);
    setSuccessMessage('');

    try {
      const result = await submitReviewAnswers({
        token,
        answers: Object.entries(answers).map(([questionId, grade]) => ({
          id_question: Number(questionId),
          grade: Number(grade ?? 0),
        })),
        save_mode: mode,
      });

      if (mode === 'full') {
        setSuccessMessage('Ответы успешно отправлены.');
        try {
          await refreshProfile();
        } catch (profileError) {
          console.warn('Не удалось обновить профиль после отправки самооценки', profileError);
        }
      } else {
        setSuccessMessage('Черновик сохранён. Вы можете вернуться позже.');
      }
      setPayload((prev) => ({ ...prev }));
    } catch (submitError) {
      console.error('Не удалось отправить ответы', submitError);
      setError('Не удалось отправить ответы. Проверьте сетевое подключение и попробуйте снова.');
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

      <section className="review-card">
        {groupedQuestions.length === 0 && (
          <p className="muted">Нет вопросов для оценки.</p>
        )}

        {groupedQuestions.map((group) => (
          <article key={group.category} className="review-group">
            <header>
              <h2>{group.category}</h2>
              <span>{payload.review_type === 'self' ? 'Self' : 'Peer'}</span>
            </header>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <div>
                    <p>{item.question}</p>
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
        <button type="button" className="ghost-btn" onClick={() => handleSubmit('partial')} disabled={submitting}>
          <FiSave size={16} />
          <span>Сохранить черновик</span>
        </button>
        <button type="button" className="primary-btn" onClick={() => handleSubmit('full')} disabled={submitting}>
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
  ['hard_skills', 'soft_skills'].forEach((key) => {
    const groups = data.questions[key] || [];
    groups.forEach((group) => {
      group.items.forEach((item) => {
        result[item.id] = item.grade ?? 0;
      });
    });
  });
  return result;
}

export default SkillReview;
