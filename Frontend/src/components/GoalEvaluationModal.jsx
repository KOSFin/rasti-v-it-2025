import { useState } from 'react';
import { FiX, FiChevronDown, FiChevronRight, FiCheckCircle } from 'react-icons/fi';
import { createFeedback360, createManagerReview } from '../api/services';
import './GoalEvaluationModal.css';

const RATING_LEVELS = [
  { value: 0, label: '0 - Не оценено', description: 'Оценка не выставлена' },
  { value: 1, label: '1 - Критично низко', description: 'Результат крайне неудовлетворителен' },
  { value: 2, label: '2 - Очень низко', description: 'Результат не соответствует ожиданиям' },
  { value: 3, label: '3 - Низко', description: 'Результат частично достигнут' },
  { value: 4, label: '4 - Ниже среднего', description: 'Результат близок к приемлемому' },
  { value: 5, label: '5 - Средне', description: 'Результат соответствует минимальным ожиданиям' },
  { value: 6, label: '6 - Выше среднего', description: 'Результат немного превышает ожидания' },
  { value: 7, label: '7 - Хорошо', description: 'Результат соответствует ожиданиям' },
  { value: 8, label: '8 - Очень хорошо', description: 'Результат превосходит ожидания' },
  { value: 9, label: '9 - Отлично', description: 'Результат значительно превышает ожидания' },
  { value: 10, label: '10 - Исключительно', description: 'Результат выдающийся' },
];

function GoalEvaluationModal({ goal, employee, isManager, onClose, onSuccess }) {
  const [expanded, setExpanded] = useState(true);
  const [formData, setFormData] = useState({
    results_achievement: 5,
    personal_qualities: '',
    collaboration_quality: 5,
    improvements_suggested: '',
    // Дополнительные поля для менеджера
    personal_contribution_feedback: '',
    overall_rating: 5,
    feedback_summary: '',
    promotion_recommended: false,
    development_plan: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleRatingChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        employee: employee.id,
        goal: goal.id,
        results_achievement: formData.results_achievement,
        personal_qualities: formData.personal_qualities,
        collaboration_quality: formData.collaboration_quality,
        improvements_suggested: formData.improvements_suggested,
      };

      if (isManager) {
        // Менеджерская оценка
        payload.personal_contribution_feedback = formData.personal_contribution_feedback;
        payload.overall_rating = formData.overall_rating;
        payload.feedback_summary = formData.feedback_summary;
        await createManagerReview(payload);
      } else {
        // Оценка 360
        await createFeedback360(payload);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Не удалось отправить оценку', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Не удалось отправить оценку');
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingLabel = (value) => {
    const level = RATING_LEVELS.find((l) => l.value === value);
    return level ? level.label : `${value}`;
  };

  const getRatingDescription = (value) => {
    const level = RATING_LEVELS.find((l) => l.value === value);
    return level ? level.description : '';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal evaluation-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>Оценка выполнения цели</h2>
            <p className="modal-subtitle">
              {employee.full_name || employee.username} — {goal.title}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </header>

        <div className="modal-body">
          {/* Раскрывающийся блок с целью и задачами */}
          <div className="goal-summary-block">
            <button
              type="button"
              className="goal-summary-header"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
              <span>Детали цели и задачи</span>
            </button>

            {expanded && (
              <div className="goal-summary-content">
                <div className="goal-detail">
                  <strong>Описание:</strong>
                  <p>{goal.description}</p>
                </div>
                <div className="goal-detail">
                  <strong>Ожидаемый результат:</strong>
                  <p>{goal.expected_results}</p>
                </div>
                <div className="goal-detail">
                  <strong>Задачи ({goal.tasks?.length || 0}):</strong>
                  <ul className="task-summary-list">
                    {(goal.tasks || []).map((task) => (
                      <li key={task.id} className={task.is_completed ? 'completed' : ''}>
                        {task.is_completed && <FiCheckCircle size={16} />}
                        <span>{task.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Форма оценки */}
          <form className="evaluation-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                Достижение результатов *
                <span className="rating-display">{getRatingLabel(formData.results_achievement)}</span>
              </label>
              <input
                type="range"
                name="results_achievement"
                min="0"
                max="10"
                step="1"
                value={formData.results_achievement}
                onChange={(e) => handleRatingChange('results_achievement', Number(e.target.value))}
                className="rating-slider"
              />
              <p className="rating-description">{getRatingDescription(formData.results_achievement)}</p>
            </div>

            <div className="form-group">
              <label>Личные качества *</label>
              <textarea
                name="personal_qualities"
                value={formData.personal_qualities}
                onChange={handleInputChange}
                rows={3}
                placeholder="Опишите проявленные личные качества сотрудника"
                required
              />
            </div>

            <div className="form-group">
              <label>
                Качество взаимодействия *
                <span className="rating-display">{getRatingLabel(formData.collaboration_quality)}</span>
              </label>
              <input
                type="range"
                name="collaboration_quality"
                min="0"
                max="10"
                step="1"
                value={formData.collaboration_quality}
                onChange={(e) => handleRatingChange('collaboration_quality', Number(e.target.value))}
                className="rating-slider"
              />
              <p className="rating-description">{getRatingDescription(formData.collaboration_quality)}</p>
            </div>

            <div className="form-group">
              <label>Рекомендации по улучшению *</label>
              <textarea
                name="improvements_suggested"
                value={formData.improvements_suggested}
                onChange={handleInputChange}
                rows={3}
                placeholder="Что можно улучшить?"
                required
              />
            </div>

            {isManager && (
              <>
                <div className="manager-section-divider">
                  <span>Дополнительная оценка руководителя</span>
                </div>

                <div className="form-group">
                  <label>Оценка личного вклада *</label>
                  <textarea
                    name="personal_contribution_feedback"
                    value={formData.personal_contribution_feedback}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Опишите личный вклад сотрудника в достижение целей"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Общая оценка *
                    <span className="rating-display">{getRatingLabel(formData.overall_rating)}</span>
                  </label>
                  <input
                    type="range"
                    name="overall_rating"
                    min="0"
                    max="10"
                    step="1"
                    value={formData.overall_rating}
                    onChange={(e) => handleRatingChange('overall_rating', Number(e.target.value))}
                    className="rating-slider"
                  />
                  <p className="rating-description">{getRatingDescription(formData.overall_rating)}</p>
                </div>

                <div className="form-group">
                  <label>Итоговый комментарий *</label>
                  <textarea
                    name="feedback_summary"
                    value={formData.feedback_summary}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Общий итог работы сотрудника, достижения, области для развития"
                    required
                  />
                </div>

                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      name="promotion_recommended"
                      checked={formData.promotion_recommended}
                      onChange={handleInputChange}
                    />
                    <span>Рекомендую к повышению/развитию</span>
                  </label>
                </div>

                {formData.promotion_recommended && (
                  <div className="form-group">
                    <label>План развития</label>
                    <textarea
                      name="development_plan"
                      value={formData.development_plan}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Опишите рекомендуемый план развития"
                    />
                  </div>
                )}
              </>
            )}

            {error && <div className="form-error">{error}</div>}

            <div className="modal-footer">
              <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
                Отмена
              </button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? 'Отправка...' : 'Отправить оценку'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default GoalEvaluationModal;
