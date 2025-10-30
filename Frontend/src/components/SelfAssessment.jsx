import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTasks, getSelfAssessments, createSelfAssessment } from '../api/services';
import './Common.css';

function SelfAssessment() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    task: '',
    achieved_results: '',
    personal_contribution: '',
    skills_acquired: '',
    improvements_needed: '',
    collaboration_quality: 5,
    satisfaction_score: 5,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, assessmentsRes] = await Promise.all([
        getTasks(),
        getSelfAssessments(),
      ]);
      setTasks(tasksRes.data.results || tasksRes.data);
      setAssessments(assessmentsRes.data.results || assessmentsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createSelfAssessment(formData);
      setShowForm(false);
      setFormData({
        task: '',
        achieved_results: '',
        personal_contribution: '',
        skills_acquired: '',
        improvements_needed: '',
        collaboration_quality: 5,
        satisfaction_score: 5,
      });
      fetchData();
    } catch (error) {
      console.error('Error creating assessment:', error);
      alert('Ошибка при создании самооценки');
    }
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <button onClick={() => navigate('/dashboard')} className="btn-back">
          ← Назад
        </button>
        <h1>Самооценка</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Отмена' : '+ Новая самооценка'}
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <h2>Новая самооценка</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Выберите задачу *</label>
              <select
                name="task"
                value={formData.task}
                onChange={handleChange}
                required
              >
                <option value="">-- Выберите задачу --</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Достигнутые результаты *</label>
              <textarea
                name="achieved_results"
                value={formData.achieved_results}
                onChange={handleChange}
                rows="4"
                placeholder="Опишите, какие результаты вы достигли"
                required
              />
            </div>

            <div className="form-group">
              <label>Личный вклад *</label>
              <textarea
                name="personal_contribution"
                value={formData.personal_contribution}
                onChange={handleChange}
                rows="4"
                placeholder="Опишите ваш личный вклад в достижение результатов"
                required
              />
            </div>

            <div className="form-group">
              <label>Приобретенные навыки *</label>
              <textarea
                name="skills_acquired"
                value={formData.skills_acquired}
                onChange={handleChange}
                rows="3"
                placeholder="Какие навыки вы приобрели или улучшили"
                required
              />
            </div>

            <div className="form-group">
              <label>Области для улучшения *</label>
              <textarea
                name="improvements_needed"
                value={formData.improvements_needed}
                onChange={handleChange}
                rows="3"
                placeholder="Что можно улучшить в будущем"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Качество сотрудничества (0-10) *</label>
                <input
                  type="number"
                  name="collaboration_quality"
                  value={formData.collaboration_quality}
                  onChange={handleChange}
                  min="0"
                  max="10"
                  required
                />
                <small>Текущее значение: {formData.collaboration_quality}</small>
              </div>

              <div className="form-group">
                <label>Уровень удовлетворенности (0-10) *</label>
                <input
                  type="number"
                  name="satisfaction_score"
                  value={formData.satisfaction_score}
                  onChange={handleChange}
                  min="0"
                  max="10"
                  required
                />
                <small>Текущее значение: {formData.satisfaction_score}</small>
              </div>
            </div>

            <button type="submit" className="btn-primary">
              Создать самооценку
            </button>
          </form>
        </div>
      )}

      <div className="content-section">
        <h2>История самооценок</h2>
        {assessments.length === 0 ? (
          <div className="empty-state">
            <p>У вас пока нет самооценок</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Задача</th>
                  <th>Дата создания</th>
                  <th>Балл</th>
                  <th>Сотрудничество</th>
                  <th>Удовлетворенность</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>{assessment.task_title}</td>
                    <td>{new Date(assessment.created_at).toLocaleDateString('ru-RU')}</td>
                    <td><strong>{assessment.calculated_score}</strong></td>
                    <td>{assessment.collaboration_quality}/10</td>
                    <td>{assessment.satisfaction_score}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default SelfAssessment;
