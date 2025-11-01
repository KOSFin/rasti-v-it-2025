import { useEffect, useMemo, useState } from 'react';
import { getSelfAssessments, getPendingSelfAssessments } from '../api/services';
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

function SelfAssessment() {
  const [pendingGoals, setPendingGoals] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [pendingRes, assessmentsRes] = await Promise.all([
        getPendingSelfAssessments(),
        getSelfAssessments({ page_size: 200, ordering: '-created_at' }),
      ]);

      setPendingGoals(extractResults(pendingRes));
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
    return {
      count: assessments.length,
      average: assessments.length
        ? (
            assessments.reduce((sum, item) => sum + (item.calculated_score || 0), 0) /
            assessments.length
          ).toFixed(1)
        : '0.0',
      lastDate: assessments[0]?.created_at
        ? new Date(assessments[0].created_at).toLocaleDateString('ru-RU')
        : '—',
      awaiting: pendingGoals.length,
    };
  }, [assessments, pendingGoals]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Самооценка</h1>
          <p className="page-subtitle">
            Самооценка запускается автоматически после завершения цели с обязательной оценкой.
            Заполните форму в модальном окне, которое откроется сразу после завершения.
          </p>
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
          <h3>Ожидают заполнения</h3>
          <p className="insight-number warning">{metrics.awaiting}</p>
          <p className="insight-meta">Завершённые цели без самооценки</p>
        </article>
      </section>

      <section className="page-section">
        <article className="panel">
          <header className="panel-header">
            <h2>Завершённые цели без самооценки</h2>
            <span>{pendingGoals.length}</span>
          </header>
          {loading ? (
            <div className="panel placeholder">Загружаем список…</div>
          ) : pendingGoals.length === 0 ? (
            <p className="empty">Все цели с обязательной оценкой уже заполнены.</p>
          ) : (
            <ul className="list detailed">
              {pendingGoals.map((goal) => (
                <li key={goal.id}>
                  <div>
                    <strong>{goal.title}</strong>
                    <span>Завершена {new Date(goal.completed_at).toLocaleDateString('ru-RU')}</span>
                    <span className="tag muted">Создал {goal.creator_type === 'manager' ? 'руководитель' : 'сотрудник'}</span>
                  </div>
                  <span className="tag muted">Оценка откроется автоматически</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="page-section">
        {loading ? (
          <div className="panel placeholder">Загружаем историю…</div>
        ) : (
          <div className="cards-grid history-grid">
            {assessments.length === 0 ? (
              <div className="panel empty">
                <p>Самооценок пока нет. Они появятся после завершения первых целей.</p>
              </div>
            ) : (
              assessments.map((assessment) => (
                <article key={assessment.id} className="card assessment-card">
                  <header className="card-header">
                    <div>
                      <h3>{assessment.goal_title}</h3>
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
