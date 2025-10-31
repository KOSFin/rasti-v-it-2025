import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  FiCopy,
  FiInfo,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiUsers,
} from 'react-icons/fi';
import { adminCreateEmployee, getDepartments, getEmployees } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import './AdminUsers.css';

const DEFAULT_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  position: '',
  department: '',
  hire_date: '',
  is_manager: false,
  is_staff: false,
};

function AdminUsers() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const isAdmin = Boolean(user?.is_superuser);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const [employeesRes, departmentsRes] = await Promise.all([
        getEmployees({ page_size: 200, ordering: 'user__last_name' }),
        getDepartments(),
      ]);

      const employeesData = Array.isArray(employeesRes.data?.results)
        ? employeesRes.data.results
        : employeesRes.data;

      const departmentsData = Array.isArray(departmentsRes.data?.results)
        ? departmentsRes.data.results
        : departmentsRes.data;

      setEmployees(employeesData || []);
      setDepartments(departmentsData || []);
      setError('');
    } catch (err) {
      console.error('Не удалось получить сотрудников', err);
      setError('Не удалось загрузить список сотрудников. Попробуйте позже.');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadEmployees();
    }
  }, [isAdmin]);

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(null);
    setCreating(true);

    try {
      const payload = { ...form };
      if (!payload.department) {
        delete payload.department;
      }
      if (!payload.hire_date) {
        delete payload.hire_date;
      }
      if (!payload.username) {
        delete payload.username;
      }

      const response = await adminCreateEmployee(payload);
      setSuccess({
        password: response.data.temporary_password,
        username: response.data.user.username,
      });

      resetForm();
      await loadEmployees();
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Не удалось создать учетную запись. Проверьте данные.';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const totalManagers = useMemo(
    () => employees.filter((item) => item.is_manager).length,
    [employees]
  );

  const totalStaff = useMemo(
    () => employees.filter((item) => item.user_is_staff).length,
    [employees]
  );

  const handleCopyPassword = async () => {
    if (!success?.password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(success.password);
      setSuccess((prev) => ({ ...prev, copied: true }));
      setTimeout(() => setSuccess((prev) => (prev ? { ...prev, copied: false } : null)), 2000);
    } catch (copyError) {
      console.error('Не удалось скопировать пароль', copyError);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page admin-page">
      <header className="page-header">
        <div>
          <p className="page-overline">
            <FiShield size={14} /> Панель администратора
          </p>
          <h1>Управление учетными записями</h1>
          <p className="page-subtitle">
            Создавайте рабочие профили для сотрудников и управляйте доступом в систему
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn ghost" onClick={loadEmployees} disabled={loading}>
            <FiRefreshCw size={16} /> Обновить
          </button>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      {success && (
        <div className="page-banner success">
          <FiInfo size={16} /> Учётная запись <strong>{success.username}</strong> создана. Временный пароль:
          <span className="password-chip">{success.password}</span>
          <button type="button" className="btn inline" onClick={handleCopyPassword}>
            <FiCopy size={16} /> {success.copied ? 'Скопировано' : 'Скопировать'}
          </button>
        </div>
      )}

      <section className="admin-grid">
        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="panel-overline">Новый сотрудник</p>
              <h2>Создать учетную запись</h2>
            </div>
            <span className="panel-subtitle">Поля с * обязательны</span>
          </header>

          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Имя *</span>
              <input
                name="first_name"
                value={form.first_name}
                onChange={handleInputChange}
                placeholder="Иван"
                required
                disabled={creating}
              />
            </label>
            <label className="form-field">
              <span>Фамилия *</span>
              <input
                name="last_name"
                value={form.last_name}
                onChange={handleInputChange}
                placeholder="Иванов"
                required
                disabled={creating}
              />
            </label>
            <label className="form-field">
              <span>Электронная почта *</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleInputChange}
                placeholder="user@example.com"
                required
                disabled={creating}
              />
            </label>
            <label className="form-field">
              <span>Имя пользователя</span>
              <input
                name="username"
                value={form.username}
                onChange={handleInputChange}
                placeholder="(опционально)"
                disabled={creating}
              />
            </label>
            <label className="form-field">
              <span>Должность *</span>
              <input
                name="position"
                value={form.position}
                onChange={handleInputChange}
                placeholder="Project Manager"
                required
                disabled={creating}
              />
            </label>
            <label className="form-field">
              <span>Отдел</span>
              <select
                name="department"
                value={form.department}
                onChange={handleInputChange}
                disabled={creating}
              >
                <option value="">Не выбран</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Дата приема</span>
              <input
                type="date"
                name="hire_date"
                value={form.hire_date}
                onChange={handleInputChange}
                disabled={creating}
              />
            </label>
            <div className="form-field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  name="is_manager"
                  checked={form.is_manager}
                  onChange={handleInputChange}
                  disabled={creating}
                />
                <span>Сделать менеджером</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="is_staff"
                  checked={form.is_staff}
                  onChange={handleInputChange}
                  disabled={creating}
                />
                <span>Доступ к админке Django</span>
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="btn ghost" onClick={resetForm} disabled={creating}>
                Очистить
              </button>
              <button type="submit" className="btn primary" disabled={creating}>
                <FiPlus size={16} /> {creating ? 'Создаём…' : 'Создать пользователя'}
              </button>
            </div>
          </form>
        </article>

        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="panel-overline">Текущие учетные записи</p>
              <h2>Список сотрудников</h2>
            </div>
            <div className="panel-badges">
              <span className="badge">
                <FiUsers size={14} /> Всего: {employees.length}
              </span>
              <span className="badge">
                Менеджеры: {totalManagers}
              </span>
              <span className="badge">
                Сотрудники штаба: {totalStaff}
              </span>
            </div>
          </header>

          <div className="table-wrapper">
            {loading ? (
              <div className="table-placeholder">Загружаем сотрудников…</div>
            ) : employees.length === 0 ? (
              <div className="table-placeholder empty">Пока нет созданных сотрудников</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Должность</th>
                    <th>Отдел</th>
                    <th>Менеджер</th>
                    <th>Админ</th>
                    <th>Дата приема</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <div className="table-name">
                          <strong>{employee.full_name || employee.username}</strong>
                          <span>{employee.email}</span>
                        </div>
                      </td>
                      <td>{employee.position || '—'}</td>
                      <td>{employee.department_name || '—'}</td>
                      <td>
                        <span className={`status ${employee.is_manager ? 'status-on' : 'status-off'}`}>
                          {employee.is_manager ? 'Да' : 'Нет'}
                        </span>
                      </td>
                      <td>
                        <span className={`status ${employee.user_is_staff ? 'status-on' : 'status-off'}`}>
                          {employee.user_is_staff ? 'Да' : 'Нет'}
                        </span>
                      </td>
                      <td>
                        {employee.hire_date
                          ? new Date(employee.hire_date).toLocaleDateString('ru-RU')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

export default AdminUsers;
