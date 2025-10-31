import { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiAward, FiTrendingUp } from 'react-icons/fi';
import { getTasks, getSelfAssessments, createSelfAssessment } from '../api/services';
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
  task: '',
  achieved_results: '',
  personal_contribution: '',
  skills_acquired: '',
  improvements_needed: '',
  collaboration_quality: 5,
  satisfaction_score: 5,
};

function SelfAssessment() {
  const [tasks, setTasks] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [tasksRes, assessmentsRes] = await Promise.all([
        getTasks({ page_size: 200 }),
        getSelfAssessments({ page_size: 200, ordering: '-created_at' }),
      ]);

      setTasks(extractResults(tasksRes));
      setAssessments(extractResults(assessmentsRes));
    } catch (err) {
      console.error('Не удалось загрузить данные самооценки', err);
      setError('Не удалось загрузить данные. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const metrics = useMemo(() => {
    if (!assessments.length) {
      return {
        count: 0,
        average: '0.0',
        lastDate: '—',
        withoutAssessment: tasks.length,
      };
    }

    const averageScore = (
      assessments.reduce((sum, item) => sum + (item.calculated_score || 0), 0) / assessments.length
    ).toFixed(1);
    const last = assessments[0]?.created_at
      ? new Date(assessments[0].created_at).toLocaleDateString('ru-RU')
      : '—';

    const tasksWithAssessment = new Set(assessments.map((item) => item.task));

    return {
      count: assessments.length,
      average: averageScore,
      lastDate: last,
      withoutAssessment: tasks.filter((task) => !tasksWithAssessment.has(task.id)).length,
    };
  }, [assessments, tasks]);

  const handleChange = (event) => {
    const { name, value, type } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.task) {
      setError('Выберите задачу для самооценки.');
      return;
    }

    setSaving(true);

    try {
      await createSelfAssessment(formData);
      setFormData(DEFAULT_FORM);
      setShowForm(false);
      await loadData();
    } catch (err) {
      console.error('Не удалось создать самооценку', err);
      setError('Не удалось сохранить самооценку. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Самооценка</h1>
          <p className="page-subtitle">Отслеживайте личный прогресс и фиксируйте выводы по задачам</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn primary" onClick={() => setShowForm((prev) => !prev)}>
            <FiPlus size={16} /> {showForm ? 'Скрыть форму' : 'Добавить самооценку'}
          </button>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      <section className="insights-grid">
        <article className="insight-card">
          <h3>Заполнено</h3>
          <p className="insight-number accent">{metrics.count}</p>
          <p className="insight-meta">Самооценок в системе</p>
        </article>
        <article className="insight-card">
          <h3>Средний балл</h3>
          <p className="insight-number success">{metrics.average}</p>
          <p className="insight-meta">По формуле Excel</p>
        </article>
        <article className="insight-card">
          <h3>Последняя оценка</h3>
          <p className="insight-number">{metrics.lastDate}</p>
          <p className="insight-meta">Дата последнего ввода</p>
        </article>
        <article className="insight-card">
          <h3>Без самооценки</h3>
          <p className="insight-number warning">{metrics.withoutAssessment}</p>
          <p className="insight-meta">Задач ждут анализа</p>
        </article>
      </section>

      {showForm && (
        <section className="panel">
          <header className="panel-header">
            <h2>Новая самооценка</h2>
            <span>Зафиксируйте результат и развитие по выбранной задаче</span>
          </header>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Задача *</span>
              <select name="task" value={formData.task} onChange={handleChange} required>
                <option value="">Выберите задачу</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field span-2">
              <span>Достигнутые результаты *</span>
              <textarea
                name="achieved_results"
                value={formData.achieved_results}
                onChange={handleChange}
                rows={3}
                placeholder="Опишите ключевые результаты"
                required
              />
            </label>
            <label className="form-field span-2">
              <span>Личный вклад *</span>
              <textarea
                name="personal_contribution"
                value={formData.personal_contribution}
                onChange={handleChange}
                rows={3}
                placeholder="Какой вклад внесли лично вы?"
                required
              />
            </label>
            <label className="form-field span-2">
              <span>Приобретённые навыки *</span>
              <textarea
                name="skills_acquired"
                value={formData.skills_acquired}
                onChange={handleChange}
                rows={3}
                placeholder="Какие навыки появились или усилились?"
                required
              />
            </label>
            <label className="form-field span-2">
              <span>Зоны роста *</span>
              <textarea
                name="improvements_needed"
                value={formData.improvements_needed}
                onChange={handleChange}
                rows={3}
                placeholder="Что стоит улучшить в дальнейшем?"
                required
              />
            </label>
            <label className="form-field">
              <span>Сотрудничество *</span>
              <input
                type="number"
                min={0}
                max={10}
                name="collaboration_quality"
                value={formData.collaboration_quality}
                onChange={handleChange}
                required
              />
              <small>Оцените командное взаимодействие (0-10)</small>
            </label>
            <label className="form-field">
              <span>Удовлетворённость *</span>
              <input
                type="number"
                min={0}
                max={10}
                name="satisfaction_score"
                value={formData.satisfaction_score}
                onChange={handleChange}
                required
              />
              <small>Насколько вы довольны результатом? (0-10)</small>
            </label>
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>
                Отменить
              </button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? 'Сохраняем…' : 'Сохранить самооценку'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="page-section">
        {loading ? (
          <div className="panel placeholder">Загружаем историю…</div>
        ) : (
          <div className="cards-grid history-grid">
            {assessments.length === 0 ? (
              <div className="panel empty">
                <p>Самооценок пока нет. Добавьте первую запись.</p>
              </div>
            ) : (
              assessments.map((assessment) => (
                <article key={assessment.id} className="card assessment-card">
                  <header className="card-header">
                    <div>
                      <h3>{assessment.task_title}</h3>
                      <span className="card-meta">{new Date(assessment.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <span className="score">{assessment.calculated_score}</span>
                  </header>
                  <div className="card-body">
                    <p><strong>Результаты:</strong> {assessment.achieved_results}</p>
                    <p><strong>Вклад:</strong> {assessment.personal_contribution}</p>
                    <p><strong>Навыки:</strong> {assessment.skills_acquired}</p>
                    <p><strong>Зоны роста:</strong> {assessment.improvements_needed}</p>
                  </div>
                  <footer className="card-footer">
                    <span className="tag">Сотрудничество {assessment.collaboration_quality}/10</span>
                    <span className="tag">Удовлетворённость {assessment.satisfaction_score}/10</span>
                  </footer>
                </article>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default SelfAssessment;
