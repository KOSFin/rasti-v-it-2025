import { useState, useEffect } from 'react';
import { FiX, FiCheckCircle } from 'react-icons/fi';
import { createSelfAssessment } from '../api/services';
import './SelfAssessmentModal.css';

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

const STORAGE_KEY_PREFIX = 'self_assessment_';

function SelfAssessmentModal({ goal, onClose, onSuccess }) {
  const storageKey = `${STORAGE_KEY_PREFIX}${goal.id}`;

  const [formData, setFormData] = useState(() => {
    // Попытка восстановить из localStorage
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Игнорируем ошибки парсинга
      }
    }
    return {
      achieved_results: '',
      personal_contribution: '',
      skills_acquired: '',
      improvements_needed: '',
      collaboration_quality: 5,
      satisfaction_score: 5,
    };
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Автосохранение в localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(formData));
  }, [formData, storageKey]);

  const handleRatingChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        goal: goal.id,
        achieved_results: formData.achieved_results,
        personal_contribution: formData.personal_contribution,
        skills_acquired: formData.skills_acquired,
        improvements_needed: formData.improvements_needed,
        collaboration_quality: formData.collaboration_quality,
        satisfaction_score: formData.satisfaction_score,
      };

      await createSelfAssessment(payload);

      // Удаляем из localStorage после успешной отправки
      localStorage.removeItem(storageKey);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Не удалось отправить самооценку', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Не удалось отправить самооценку');
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
      <div className="modal self-assessment-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>Самооценка выполнения цели</h2>
            <p className="modal-subtitle">{goal.title}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </header>

        <div className="modal-body">
          <div className="goal-summary-block">
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
          </div>

          <form className="evaluation-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Достигнутые результаты *</label>
              <textarea
                name="achieved_results"
                value={formData.achieved_results}
                onChange={handleInputChange}
                rows={4}
                placeholder="Опишите какие результаты были достигнуты"
                required
              />
            </div>

            <div className="form-group">
              <label>Личный вклад *</label>
              <textarea
                name="personal_contribution"
                value={formData.personal_contribution}
                onChange={handleInputChange}
                rows={3}
                placeholder="Опишите ваш личный вклад в достижение цели"
                required
              />
            </div>

            <div className="form-group">
              <label>Приобретённые навыки *</label>
              <textarea
                name="skills_acquired"
                value={formData.skills_acquired}
                onChange={handleInputChange}
                rows={3}
                placeholder="Какие новые навыки вы приобрели?"
                required
              />
            </div>

            <div className="form-group">
              <label>Что нужно улучшить *</label>
              <textarea
                name="improvements_needed"
                value={formData.improvements_needed}
                onChange={handleInputChange}
                rows={3}
                placeholder="Что можно было сделать лучше?"
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
              <label>
                Удовлетворённость работой *
                <span className="rating-display">{getRatingLabel(formData.satisfaction_score)}</span>
              </label>
              <input
                type="range"
                name="satisfaction_score"
                min="0"
                max="10"
                step="1"
                value={formData.satisfaction_score}
                onChange={(e) => handleRatingChange('satisfaction_score', Number(e.target.value))}
                className="rating-slider"
              />
              <p className="rating-description">{getRatingDescription(formData.satisfaction_score)}</p>
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="info-note">
              <p>💡 Ваша самооценка сохраняется автоматически. Вы можете закрыть форму и вернуться позже.</p>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
                Закрыть
              </button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? 'Отправка...' : 'Отправить самооценку'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SelfAssessmentModal;
