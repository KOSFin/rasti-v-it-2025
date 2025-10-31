import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  FiCopy,
  FiInfo,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import {
  adminCreateEmployee,
  deleteEmployee,
  getDepartments,
  getEmployees,
  resetEmployeePassword,
} from '../api/services';
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
  const isAdmin = Boolean(user?.is_superuser);

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [passwordInfo, setPasswordInfo] = useState(null);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const [employeesRes, departmentsRes] = await Promise.all([
        getEmployees({ page_size: 500, ordering: 'user__last_name' }),
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

  const openCreateModal = () => {
    setShowCreateModal(true);
    setError('');
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
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
        username: response.data.user.username,
        password: response.data.temporary_password,
        copied: false,
      });

      closeCreateModal();
      await loadEmployees();
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.response?.data?.email?.[0] ||
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

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return employees;
    }

    return employees.filter((employee) => {
      const fullName = employee.full_name?.toLowerCase() || '';
      const email = employee.email?.toLowerCase() || '';
      const username = employee.username?.toLowerCase() || '';
      const department = employee.department_name?.toLowerCase() || '';

      return [fullName, email, username, department].some((value) => value.includes(query));
    });
  }, [employees, search]);

  const openEmployeeModal = (employee) => {
    setSelectedEmployee(employee);
    setPasswordInfo(null);
    setShowEmployeeModal(true);
  };

  const closeEmployeeModal = () => {
    setShowEmployeeModal(false);
    setSelectedEmployee(null);
    setPasswordInfo(null);
  };

  const handleResetPassword = async (employee) => {
    try {
      const response = await resetEmployeePassword(employee.id);
      const details = {
        username: response.data.username,
        password: response.data.temporary_password,
        copied: false,
      };
      setPasswordInfo(details);
      setSuccess(details);
      await loadEmployees();
    } catch (err) {
      console.error('Не удалось сбросить пароль', err);
      setError('Не удалось обновить пароль сотрудника.');
    }
  };

  const handleDeleteEmployee = async (employee) => {
    const confirmed = window.confirm(
      'Удалить сотрудника и его доступ? Действие необратимо.'
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteEmployee(employee.id);
      closeEmployeeModal();
      await loadEmployees();
    } catch (err) {
      console.error('Не удалось удалить сотрудника', err);
      setError('Удаление сотрудника не удалось.');
    }
  };

  const handleCopyPassword = async (passwordState, updateState) => {
    if (!passwordState?.password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(passwordState.password);
      updateState((prev) => (prev ? { ...prev, copied: true } : null));
      setTimeout(() => updateState((prev) => (prev ? { ...prev, copied: false } : null)), 2000);
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
            Создавайте рабочие профили, обновляйте доступ и следите за статусами сотрудников
          </p>
        </div>
        <div className="page-actions">
          <div className="input-with-icon">
            <FiSearch size={16} />
            <input
              type="search"
              placeholder="Поиск по имени, почте или отделу"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button type="button" className="btn ghost" onClick={loadEmployees} disabled={loading}>
            <FiRefreshCw size={16} /> Обновить
          </button>
          <Link to="/admin/departments" className="btn secondary">
            Управление отделами
          </Link>
          <button type="button" className="btn primary" onClick={openCreateModal}>
            <FiPlus size={16} /> Новый сотрудник
          </button>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      {success && success.password && (
        <div className="page-banner success">
          <FiInfo size={16} /> Учётная запись <strong>{success.username}</strong> обновлена. Временный пароль:
          <span className="password-chip">{success.password}</span>
          <button
            type="button"
            className="btn inline"
            onClick={() => handleCopyPassword(success, setSuccess)}
          >
            <FiCopy size={16} /> {success.copied ? 'Скопировано' : 'Скопировать'}
          </button>
        </div>
      )}

      <section className="panel">
        <header className="panel-header">
          <div>
            <p className="panel-overline">Текущие учетные записи</p>
            <h2>Сотрудники компании</h2>
          </div>
          <div className="panel-badges">
            <span className="badge">
              <FiUsers size={14} /> Всего: {employees.length}
            </span>
            <span className="badge">Менеджеры: {totalManagers}</span>
            <span className="badge">Администрирование: {totalStaff}</span>
          </div>
        </header>

        <div className="table-wrapper">
          {loading ? (
            <div className="table-placeholder">Загружаем сотрудников…</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="table-placeholder empty">
              {search ? 'По запросу сотрудники не найдены.' : 'Пока нет созданных сотрудников.'}
            </div>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
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
                    <td>
                      <button
                        type="button"
                        className="btn inline"
                        onClick={() => openEmployeeModal(employee)}
                      >
                        Подробнее
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {showCreateModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal large">
            <header className="modal-header">
              <h2>Новый сотрудник</h2>
              <button type="button" className="modal-close" onClick={closeCreateModal}>
                <FiX size={18} />
              </button>
            </header>
            <form className="modal-body form-grid" onSubmit={handleSubmit}>
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
              <div className="form-field checkbox-field span-2">
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
                  <span>Открыть доступ к админке Django</span>
                </label>
              </div>
              <footer className="modal-footer span-2">
                <button type="button" className="btn ghost" onClick={closeCreateModal}>
                  Отмена
                </button>
                <button type="submit" className="btn primary" disabled={creating}>
                  <FiPlus size={16} /> {creating ? 'Создаём…' : 'Создать сотрудника'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {showEmployeeModal && selectedEmployee && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal large">
            <header className="modal-header">
              <div>
                <h2>{selectedEmployee.full_name || selectedEmployee.username}</h2>
                <p className="modal-subtitle">{selectedEmployee.email}</p>
              </div>
              <button type="button" className="modal-close" onClick={closeEmployeeModal}>
                <FiX size={18} />
              </button>
            </header>
            <div className="modal-body">
              <dl className="detail-grid">
                <div>
                  <dt>Имя пользователя</dt>
                  <dd>{selectedEmployee.username}</dd>
                </div>
                <div>
                  <dt>Должность</dt>
                  <dd>{selectedEmployee.position || '—'}</dd>
                </div>
                <div>
                  <dt>Отдел</dt>
                  <dd>{selectedEmployee.department_name || '—'}</dd>
                </div>
                <div>
                  <dt>Менеджер</dt>
                  <dd>{selectedEmployee.is_manager ? 'Да' : 'Нет'}</dd>
                </div>
                <div>
                  <dt>Доступ к админке</dt>
                  <dd>{selectedEmployee.user_is_staff ? 'Открыт' : 'Нет'}</dd>
                </div>
                <div>
                  <dt>Дата приема</dt>
                  <dd>
                    {selectedEmployee.hire_date
                      ? new Date(selectedEmployee.hire_date).toLocaleDateString('ru-RU')
                      : '—'}
                  </dd>
                </div>
              </dl>

              <section className="credentials-card">
                <header>
                  <h3>Доступы сотрудника</h3>
                  <p>
                    Пароли хранятся зашифрованными. Сгенерируйте новый временный пароль, чтобы передать его
                    сотруднику.
                  </p>
                </header>
                {passwordInfo?.password ? (
                  <div className="credentials-row">
                    <div>
                      <span>Временный пароль</span>
                      <strong>{passwordInfo.password}</strong>
                    </div>
                    <button
                      type="button"
                      className="btn inline"
                      onClick={() => handleCopyPassword(passwordInfo, setPasswordInfo)}
                    >
                      <FiCopy size={16} /> {passwordInfo.copied ? 'Скопировано' : 'Скопировать'}
                    </button>
                  </div>
                ) : (
                  <p className="credentials-hint">Сгенерируйте новый пароль, чтобы отобразить его здесь.</p>
                )}
              </section>
            </div>
            <footer className="modal-footer">
              <button
                type="button"
                className="btn danger"
                onClick={() => handleDeleteEmployee(selectedEmployee)}
              >
                <FiTrash2 size={16} /> Удалить сотрудника
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => handleResetPassword(selectedEmployee)}
              >
                Сгенерировать новый пароль
              </button>
              <button type="button" className="btn ghost" onClick={closeEmployeeModal}>
                Закрыть
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;
