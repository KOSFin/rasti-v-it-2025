import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGoals, createGoal, deleteGoal } from '../api/services';
import './Common.css';

function Goals() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal_type: 'tactical',
    start_date: '',
    end_date: '',
    expected_results: '',
    task_link: '',
  });

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await getGoals();
      setGoals(response.data.results || response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching goals:', error);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createGoal(formData);
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        goal_type: 'tactical',
        start_date: '',
        end_date: '',
        expected_results: '',
        task_link: '',
      });
      fetchGoals();
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Ошибка при создании цели');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить эту цель?')) {
      try {
        await deleteGoal(id);
        fetchGoals();
      } catch (error) {
        console.error('Error deleting goal:', error);
      }
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
        <h1>Мои цели</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Отмена' : '+ Добавить цель'}
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <h2>Новая цель</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Название цели *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Описание *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Тип цели *</label>
                <select
                  name="goal_type"
                  value={formData.goal_type}
                  onChange={handleChange}
                  required
                >
                  <option value="strategic">Стратегическая цель</option>
                  <option value="tactical">Тактическая задача</option>
                  <option value="personal">Личное развитие</option>
                </select>
              </div>

              <div className="form-group">
                <label>Дата начала *</label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Дата окончания *</label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Ожидаемые результаты *</label>
              <textarea
                name="expected_results"
                value={formData.expected_results}
                onChange={handleChange}
                rows="3"
                required
              />
            </div>

            <div className="form-group">
              <label>Ссылка на задачу (опционально)</label>
              <input
                type="url"
                name="task_link"
                value={formData.task_link}
                onChange={handleChange}
                placeholder="https://..."
              />
            </div>

            <button type="submit" className="btn-primary">
              Создать цель
            </button>
          </form>
        </div>
      )}

      <div className="content-section">
        {goals.length === 0 ? (
          <div className="empty-state">
            <p>У вас пока нет целей</p>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Создать первую цель
            </button>
          </div>
        ) : (
          <div className="items-grid">
            {goals.map((goal) => (
              <div key={goal.id} className="item-card">
                <div className="item-header">
                  <h3>{goal.title}</h3>
                  <span className={`badge badge-${goal.goal_type}`}>
                    {goal.goal_type === 'strategic' && 'Стратегическая'}
                    {goal.goal_type === 'tactical' && 'Тактическая'}
                    {goal.goal_type === 'personal' && 'Личное развитие'}
                  </span>
                </div>
                <p className="item-description">{goal.description}</p>
                <div className="item-meta">
                  <span>📅 {goal.start_date} - {goal.end_date}</span>
                </div>
                <div className="item-actions">
                  <button onClick={() => navigate(`/tasks?goal=${goal.id}`)} className="btn-secondary">
                    Задачи
                  </button>
                  <button onClick={() => handleDelete(goal.id)} className="btn-danger">
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Goals;
