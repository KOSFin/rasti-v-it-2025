import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingFeedback360, getFeedback360ForMe, getTasks, createFeedback360 } from '../api/services';
import './Common.css';

function Feedback360() {
  const navigate = useNavigate();
  const [colleagues, setColleagues] = useState([]);
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employee: '',
    task: '',
    results_achievement: 5,
    personal_qualities: '',
    collaboration_quality: 5,
    improvements_suggested: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [colleaguesRes, feedbacksRes, tasksRes] = await Promise.all([
        getPendingFeedback360(),
        getFeedback360ForMe(),
        getTasks(),
      ]);
      setColleagues(colleaguesRes.data);
      setMyFeedbacks(feedbacksRes.data);
      setTasks(tasksRes.data.results || tasksRes.data);
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
      await createFeedback360(formData);
      setShowForm(false);
      setFormData({
        employee: '',
        task: '',
        results_achievement: 5,
        personal_qualities: '',
        collaboration_quality: 5,
        improvements_suggested: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error creating feedback:', error);
      alert('Ошибка при создании оценки');
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
        <h1>Обратная связь 360°</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Отмена' : '+ Дать оценку'}
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <h2>Оценка коллеги</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Выберите сотрудника *</label>
              <select
                name="employee"
                value={formData.employee}
                onChange={handleChange}
                required
              >
                <option value="">-- Выберите сотрудника --</option>
                {colleagues.map((colleague) => (
                  <option key={colleague.id} value={colleague.id}>
                    {colleague.full_name} - {colleague.position}
                  </option>
                ))}
              </select>
            </div>

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
              <label>Достижение результатов (0-10) *</label>
              <input
                type="number"
                name="results_achievement"
                value={formData.results_achievement}
                onChange={handleChange}
                min="0"
                max="10"
                required
              />
              <small>Текущее значение: {formData.results_achievement}</small>
            </div>

            <div className="form-group">
              <label>Личные качества *</label>
              <textarea
                name="personal_qualities"
                value={formData.personal_qualities}
                onChange={handleChange}
                rows="4"
                placeholder="Опишите личные качества сотрудника"
                required
              />
            </div>

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
              <label>Рекомендации по улучшению *</label>
              <textarea
                name="improvements_suggested"
                value={formData.improvements_suggested}
                onChange={handleChange}
                rows="3"
                placeholder="Что можно улучшить"
                required
              />
            </div>

            <button type="submit" className="btn-primary">
              Отправить оценку
            </button>
          </form>
        </div>
      )}

      <div className="content-section">
        <h2>Оценки обо мне</h2>
        {myFeedbacks.length === 0 ? (
          <div className="empty-state">
            <p>Пока нет оценок</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>От кого</th>
                  <th>Задача</th>
                  <th>Дата</th>
                  <th>Балл</th>
                  <th>Достижения</th>
                  <th>Сотрудничество</th>
                </tr>
              </thead>
              <tbody>
                {myFeedbacks.map((feedback) => (
                  <tr key={feedback.id}>
                    <td>{feedback.assessor_name}</td>
                    <td>{feedback.task_title}</td>
                    <td>{new Date(feedback.created_at).toLocaleDateString('ru-RU')}</td>
                    <td><strong>{feedback.calculated_score}</strong></td>
                    <td>{feedback.results_achievement}/10</td>
                    <td>{feedback.collaboration_quality}/10</td>
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

export default Feedback360;
