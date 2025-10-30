import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTasks, getGoals, createTask, updateTask, deleteTask } from '../api/services';
import './Common.css';

function Tasks() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const goalId = searchParams.get('goal');
  
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    goal: goalId || '',
    title: '',
    description: '',
    is_completed: false,
  });

  useEffect(() => {
    fetchData();
  }, [goalId]);

  const fetchData = async () => {
    try {
      const params = goalId ? { goal: goalId } : {};
      const [tasksRes, goalsRes] = await Promise.all([
        getTasks(params),
        getGoals(),
      ]);
      setTasks(tasksRes.data.results || tasksRes.data);
      setGoals(goalsRes.data.results || goalsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createTask(formData);
      setShowForm(false);
      setFormData({
        goal: goalId || '',
        title: '',
        description: '',
        is_completed: false,
      });
      fetchData();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Ошибка при создании задачи');
    }
  };

  const handleToggleComplete = async (task) => {
    try {
      await updateTask(task.id, { ...task, is_completed: !task.is_completed });
      fetchData();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить эту задачу?')) {
      try {
        await deleteTask(id);
        fetchData();
      } catch (error) {
        console.error('Error deleting task:', error);
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
        <h1>Задачи</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Отмена' : '+ Добавить задачу'}
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <h2>Новая задача</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Выберите цель *</label>
              <select
                name="goal"
                value={formData.goal}
                onChange={handleChange}
                required
              >
                <option value="">-- Выберите цель --</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Название задачи *</label>
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

            <div className="form-group">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  name="is_completed"
                  checked={formData.is_completed}
                  onChange={handleChange}
                />
                Задача выполнена
              </label>
            </div>

            <button type="submit" className="btn-primary">
              Создать задачу
            </button>
          </form>
        </div>
      )}

      <div className="content-section">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <p>Задач не найдено</p>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Создать первую задачу
            </button>
          </div>
        ) : (
          <div className="items-grid">
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className={`item-card ${task.is_completed ? 'completed-task' : ''}`}
              >
                <div className="item-header">
                  <h3 style={{ textDecoration: task.is_completed ? 'line-through' : 'none' }}>
                    {task.title}
                  </h3>
                  {task.is_completed && (
                    <span className="badge badge-strategic">✓ Выполнена</span>
                  )}
                </div>
                <p className="item-description">{task.description}</p>
                <div className="item-actions">
                  <button 
                    onClick={() => handleToggleComplete(task)} 
                    className="btn-secondary"
                  >
                    {task.is_completed ? 'Отметить как невыполненную' : 'Отметить выполненной'}
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="btn-danger">
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

export default Tasks;
