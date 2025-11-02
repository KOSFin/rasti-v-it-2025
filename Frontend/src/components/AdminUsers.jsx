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
  getAllEmployees,
  getDepartments,
  getEmployee,
  resetEmployeePassword,
  updateEmployee,
} from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import './AdminUsers.css';

const ROLE_OPTIONS = [
  { value: 'employee', label: 'Сотрудник' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'business_partner', label: 'Бизнес-партнер' },
];

const createEmptyEmployeeForm = () => ({
  id: null,
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  department: '',
  position: '',
  hire_date: '',
  role: 'employee',
  is_superuser: false,
  is_staff: false,
});

function AdminUsers() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_superuser);

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [createForm, setCreateForm] = useState(createEmptyEmployeeForm());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [passwordInfo, setPasswordInfo] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const [employeesList, departmentsRes] = await Promise.all([
        getAllEmployees({ ordering: 'user__last_name' }),
        getDepartments(),
      ]);

      const departmentsData = Array.isArray(departmentsRes.data?.results)
        ? departmentsRes.data.results
        : departmentsRes.data;

      setEmployees(employeesList || []);
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

  const positionsByDepartment = useMemo(() => {
    const map = new Map();
    departments.forEach((department) => {
      map.set(
        String(department.id),
        [...(department.positions || [])].sort(
          (a, b) => (a.importance ?? 0) - (b.importance ?? 0)
        )
      );
    });
    return map;
  }, [departments]);

  const positionsForCreate = useMemo(() => {
    if (!createForm.department) {
      return [];
    }
    return positionsByDepartment.get(String(createForm.department)) || [];
  }, [positionsByDepartment, createForm.department]);

  const positionsForEdit = useMemo(() => {
    if (!editForm?.department) {
      return [];
    }
    return positionsByDepartment.get(String(editForm.department)) || [];
  }, [positionsByDepartment, editForm?.department]);

  const handleCreateInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCreateForm((prev) => {
      let nextValue = type === 'checkbox' ? checked : value;

      if (name === 'department') {
        return {
          ...prev,
          department: nextValue,
          position: '',
        };
      }

      if (name === 'role' && prev.is_superuser) {
        return prev;
      }

      if (name === 'is_superuser') {
        const isSuper = Boolean(nextValue);
        return {
          ...prev,
          is_superuser: isSuper,
          is_staff: isSuper ? true : prev.is_staff,
          role: isSuper ? 'admin' : prev.role === 'admin' ? 'employee' : prev.role,
        };
      }

      if (name === 'is_staff' && prev.is_superuser) {
        return prev;
      }

      return {
        ...prev,
        [name]: nextValue,
      };
    });
  };

  const handleEditInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditForm((prev) => {
      if (!prev) {
        return prev;
      }

      let nextValue = type === 'checkbox' ? checked : value;

      if (name === 'department') {
        return {
          ...prev,
          department: nextValue,
          position: '',
        };
      }

      if (name === 'role' && prev.is_superuser) {
        return prev;
      }

      if (name === 'is_superuser') {
        const isSuper = Boolean(nextValue);
        return {
          ...prev,
          is_superuser: isSuper,
          is_staff: isSuper ? true : prev.is_staff,
          role: isSuper ? 'admin' : prev.role === 'admin' ? 'employee' : prev.role,
        };
      }

      if (name === 'is_staff' && prev.is_superuser) {
        return prev;
      }

      return {
        ...prev,
        [name]: nextValue,
      };
    });
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setError('');
    setCreateForm(createEmptyEmployeeForm());
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm(createEmptyEmployeeForm());
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(null);
    setCreating(true);

    try {
      if (!createForm.department) {
        setError('Выберите отдел для сотрудника.');
        setCreating(false);
        return;
      }

      if (!createForm.position) {
        setError('Выберите должность для сотрудника.');
        setCreating(false);
        return;
      }

      const finalRole = createForm.is_superuser ? 'admin' : createForm.role;
      const payload = {
        first_name: createForm.first_name,
        last_name: createForm.last_name,
        email: createForm.email,
        username: createForm.username,
        department: createForm.department ? Number(createForm.department) : undefined,
        position: createForm.position ? Number(createForm.position) : undefined,
        hire_date: createForm.hire_date || undefined,
        role: finalRole,
        is_superuser: createForm.is_superuser,
        is_staff: createForm.is_superuser ? true : createForm.is_staff,
        is_manager: finalRole === 'manager',
      };

      if (!payload.department) {
        delete payload.department;
      }
      if (!payload.position) {
        delete payload.position;
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
      const position = (
        employee.position_name ||
        employee.position_title ||
        ''
      ).toLowerCase();

      return [fullName, email, username, department, position].some((value) =>
        value.includes(query)
      );
    });
  }, [employees, search]);

  const buildEditForm = (detail) => ({
    id: detail.id,
    first_name: detail.user?.first_name || '',
    last_name: detail.user?.last_name || '',
    email: detail.user?.email || '',
    username: detail.user?.username || '',
    department: detail.department?.id ? String(detail.department.id) : '',
    position: detail.position?.id ? String(detail.position.id) : '',
    hire_date: detail.hire_date || '',
    role: detail.role || (detail.user?.is_superuser ? 'admin' : 'employee'),
    is_superuser: Boolean(detail.user?.is_superuser),
    is_staff: Boolean(detail.user?.is_staff),
  });

  const fetchEmployeeDetail = async (employeeId) => {
    setEditLoading(true);
    setEditError('');
    try {
      const response = await getEmployee(employeeId);
      setEditForm(buildEditForm(response.data));
      return true;
    } catch (err) {
      console.error('Не удалось загрузить данные сотрудника', err);
      setEditError('Не удалось загрузить данные сотрудника. Попробуйте позже.');
      setEditForm(null);
      return false;
    } finally {
      setEditLoading(false);
    }
  };

  const openEmployeeModal = (employee) => {
    setSelectedEmployee(employee);
    setPasswordInfo(null);
    setEditForm(null);
    setEditSuccess('');
    setShowEmployeeModal(true);
    fetchEmployeeDetail(employee.id);
  };

  const closeEmployeeModal = () => {
    setShowEmployeeModal(false);
    setSelectedEmployee(null);
    setPasswordInfo(null);
    setEditForm(null);
    setEditSuccess('');
    setEditError('');
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editForm?.id) {
      return;
    }

  setEditSaving(true);
  setEditError('');
  setEditSuccess('');

    try {
      const finalRole = editForm.is_superuser ? 'admin' : editForm.role;
      const payload = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        username: editForm.username,
        department: editForm.department ? Number(editForm.department) : undefined,
        position: editForm.position ? Number(editForm.position) : undefined,
        hire_date: editForm.hire_date || undefined,
        role: finalRole,
        is_superuser: editForm.is_superuser,
        is_staff: editForm.is_superuser ? true : editForm.is_staff,
        is_manager: finalRole === 'manager',
      };

      if (!payload.department) {
        delete payload.department;
      }
      if (!payload.position) {
        delete payload.position;
      }
      if (!payload.hire_date) {
        delete payload.hire_date;
      }
      if (!payload.username) {
        delete payload.username;
      }

      const response = await updateEmployee(editForm.id, payload);
      await loadEmployees();
      if (response?.data) {
        setSelectedEmployee(response.data);
      }
      const detailLoaded = await fetchEmployeeDetail(editForm.id);
      if (detailLoaded) {
        setEditSuccess('Данные сотрудника обновлены.');
      }
    } catch (err) {
      console.error('Не удалось обновить сотрудника', err);
      const message =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.response?.data?.email?.[0] ||
        'Не удалось обновить сотрудника.';
      setEditError(message);
    } finally {
      setEditSaving(false);
    }
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
                    <td>{employee.position_name || employee.position_title || '—'}</td>
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
                  value={createForm.first_name}
                  onChange={handleCreateInputChange}
                  placeholder="Иван"
                  required
                  disabled={creating}
                />
              </label>
              <label className="form-field">
                <span>Фамилия *</span>
                <input
                  name="last_name"
                  value={createForm.last_name}
                  onChange={handleCreateInputChange}
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
                  value={createForm.email}
                  onChange={handleCreateInputChange}
                  placeholder="user@example.com"
                  required
                  disabled={creating}
                />
              </label>
              <label className="form-field">
                <span>Имя пользователя</span>
                <input
                  name="username"
                  value={createForm.username}
                  onChange={handleCreateInputChange}
                  placeholder="(опционально)"
                  disabled={creating}
                />
              </label>
              <label className="form-field">
                <span>Отдел *</span>
                <select
                  name="department"
                  value={createForm.department}
                  onChange={handleCreateInputChange}
                  required
                  disabled={creating}
                >
                  <option value="">Выберите отдел</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Должность *</span>
                <select
                  name="position"
                  value={createForm.position}
                  onChange={handleCreateInputChange}
                  required
                  disabled={creating || !createForm.department || positionsForCreate.length === 0}
                >
                  <option value="">{createForm.department ? 'Выберите должность' : 'Сначала выберите отдел'}</option>
                  {positionsForCreate.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.title}
                    </option>
                  ))}
                </select>
                {createForm.department && positionsForCreate.length === 0 && (
                  <small className="form-hint">
                    Для отдела ещё не настроены должности. Добавьте их в разделе "Отделы".
                  </small>
                )}
              </label>
              <label className="form-field">
                <span>Дата приема</span>
                <input
                  type="date"
                  name="hire_date"
                  value={createForm.hire_date}
                  onChange={handleCreateInputChange}
                  disabled={creating}
                />
              </label>
              <label className="form-field">
                <span>Роль *</span>
                <select
                  name="role"
                  value={createForm.is_superuser ? 'admin' : createForm.role}
                  onChange={handleCreateInputChange}
                  disabled={creating || createForm.is_superuser}
                  required
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  {createForm.is_superuser && (
                    <option value="admin">Администратор</option>
                  )}
                </select>
                {createForm.is_superuser && (
                  <small className="form-hint">У суперпользователя роль назначается автоматически.</small>
                )}
              </label>
              <div className="form-field checkbox-field span-2">
                <label>
                  <input
                    type="checkbox"
                    name="is_superuser"
                    checked={createForm.is_superuser}
                    onChange={handleCreateInputChange}
                    disabled={creating}
                  />
                  <span>Сделать суперпользователем</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="is_staff"
                    checked={createForm.is_superuser ? true : createForm.is_staff}
                    onChange={handleCreateInputChange}
                    disabled={creating || createForm.is_superuser}
                  />
                  <span>Открыть доступ к админке</span>
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
                <h2>{editForm?.first_name || editForm?.last_name ? `${editForm?.first_name} ${editForm?.last_name}`.trim() : selectedEmployee.full_name || selectedEmployee.username}</h2>
                <p className="modal-subtitle">{editForm?.email || selectedEmployee.email}</p>
              </div>
              <button type="button" className="modal-close" onClick={closeEmployeeModal}>
                <FiX size={18} />
              </button>
            </header>
            {editLoading ? (
              <div className="modal-body loading">Загружаем данные сотрудника…</div>
            ) : editForm ? (
              <form className="modal-body form-grid" onSubmit={handleEditSubmit}>
                <label className="form-field">
                  <span>Имя *</span>
                  <input
                    name="first_name"
                    value={editForm?.first_name || ''}
                    onChange={handleEditInputChange}
                    required
                    disabled={editSaving}
                  />
                </label>
                <label className="form-field">
                  <span>Фамилия *</span>
                  <input
                    name="last_name"
                    value={editForm?.last_name || ''}
                    onChange={handleEditInputChange}
                    required
                    disabled={editSaving}
                  />
                </label>
                <label className="form-field">
                  <span>Электронная почта *</span>
                  <input
                    type="email"
                    name="email"
                    value={editForm?.email || ''}
                    onChange={handleEditInputChange}
                    required
                    disabled={editSaving}
                  />
                </label>
                <label className="form-field">
                  <span>Имя пользователя</span>
                  <input
                    name="username"
                    value={editForm?.username || ''}
                    onChange={handleEditInputChange}
                    disabled={editSaving}
                  />
                </label>
                <label className="form-field">
                  <span>Отдел</span>
                  <select
                    name="department"
                    value={editForm?.department || ''}
                    onChange={handleEditInputChange}
                    disabled={editSaving}
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
                  <span>Должность</span>
                  <select
                    name="position"
                    value={editForm?.position || ''}
                    onChange={handleEditInputChange}
                    disabled={
                      editSaving ||
                      !editForm?.department ||
                      positionsForEdit.length === 0
                    }
                  >
                    <option value="">{editForm?.department ? 'Выберите должность' : 'Сначала выберите отдел'}</option>
                    {positionsForEdit.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.title}
                      </option>
                    ))}
                  </select>
                  {editForm?.department && positionsForEdit.length === 0 && (
                    <small className="form-hint">
                      Для отдела ещё не настроены должности. Добавьте их в разделе "Отделы".
                    </small>
                  )}
                </label>
                <label className="form-field">
                  <span>Дата приема</span>
                  <input
                    type="date"
                    name="hire_date"
                    value={editForm?.hire_date || ''}
                    onChange={handleEditInputChange}
                    disabled={editSaving}
                  />
                </label>
                <label className="form-field">
                  <span>Роль *</span>
                  <select
                    name="role"
                    value={editForm?.is_superuser ? 'admin' : editForm?.role || 'employee'}
                    onChange={handleEditInputChange}
                    disabled={editSaving || editForm?.is_superuser}
                    required
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    {editForm?.is_superuser && (
                      <option value="admin">Администратор</option>
                    )}
                  </select>
                  {editForm?.is_superuser && (
                    <small className="form-hint">У суперпользователя роль назначается автоматически.</small>
                  )}
                </label>
                <div className="form-field checkbox-field span-2">
                  <label>
                    <input
                      type="checkbox"
                      name="is_superuser"
                      checked={Boolean(editForm?.is_superuser)}
                      onChange={handleEditInputChange}
                      disabled={editSaving}
                    />
                    <span>Суперпользователь</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="is_staff"
                      checked={editForm?.is_superuser ? true : Boolean(editForm?.is_staff)}
                      onChange={handleEditInputChange}
                      disabled={editSaving || editForm?.is_superuser}
                    />
                    <span>Доступ к админке</span>
                  </label>
                </div>

                {editError && <div className="form-hint error span-2">{editError}</div>}
                {editSuccess && <div className="form-hint success span-2">{editSuccess}</div>}

                <section className="credentials-card span-2">
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

                <footer className="modal-footer span-2">
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => handleDeleteEmployee(selectedEmployee)}
                    disabled={editSaving}
                  >
                    <FiTrash2 size={16} /> Удалить сотрудника
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => handleResetPassword(selectedEmployee)}
                    disabled={editSaving}
                  >
                    Сгенерировать новый пароль
                  </button>
                  <button type="button" className="btn ghost" onClick={closeEmployeeModal}>
                    Закрыть
                  </button>
                  <button type="submit" className="btn primary" disabled={editSaving}>
                    {editSaving ? 'Сохраняем…' : 'Сохранить изменения'}
                  </button>
                </footer>
              </form>
            ) : (
              <div className="modal-body">
                <div className="page-banner error">
                  {editError || 'Не удалось загрузить данные сотрудника. Попробуйте позже.'}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn ghost" onClick={closeEmployeeModal}>
                    Закрыть
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;
