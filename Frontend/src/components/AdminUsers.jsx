import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  FiBriefcase,
  FiCopy,
  FiLock,
  FiMail,
  FiMapPin,
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
  getEmployee,
  listDepartments,
  listEmployees,
  listOrganizations,
  listTeams,
  resetEmployeePassword,
  updateEmployee,
} from '../api/services';
import useInfinitePagination from '../hooks/useInfinitePagination';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { useAuth } from '../contexts/AuthContext';
import './AdminUsers.css';

const ROLE_FILTER_OPTIONS = [
  { label: 'Все роли', value: '' },
  { label: 'Сотрудник', value: 'employee' },
  { label: 'Менеджер', value: 'manager' },
  { label: 'Бизнес-партнёр', value: 'business_partner' },
  { label: 'Администратор', value: 'admin' },
];

const ROLE_SELECT_OPTIONS = [
  { label: 'Сотрудник', value: 'employee' },
  { label: 'Менеджер', value: 'manager' },
  { label: 'Бизнес-партнёр', value: 'business_partner' },
];

const ROLE_BADGES = {
  admin: 'Администратор',
  manager: 'Руководитель',
  business_partner: 'HR-партнёр',
};

const extractResults = (payload) => {
  const data = payload?.data ?? payload ?? {};
  if (Array.isArray(data?.results)) {
    return data.results;
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.data?.results)) {
    return data.data.results;
  }
  return data?.results || [];
};

const createInitialForm = () => ({
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  hire_date: '',
  organization: '',
  department: '',
  position: '',
  team: '',
  role: 'employee',
  is_superuser: false,
  is_staff: false,
});

const buildEditForm = (employee) => ({
  id: employee.id,
  first_name: employee.user?.first_name || '',
  last_name: employee.user?.last_name || '',
  email: employee.user?.email || '',
  username: employee.user?.username || '',
  hire_date: employee.hire_date || '',
  department: employee.department?.id ? String(employee.department.id) : '',
  position: employee.position?.id ? String(employee.position.id) : '',
  team: employee.team?.id ? String(employee.team.id) : '',
  role: employee.role || 'employee',
  is_superuser: Boolean(employee.user?.is_superuser),
  is_staff: Boolean(employee.user?.is_staff),
});

const formatEmployeeSubtitle = (employee) => {
  const position = employee.position_name || employee.position_title || '—';
  const department = employee.department_name || 'Без отдела';
  return `${position} • ${department}`;
};

function AdminUsers() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_superuser);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const {
    items: employees,
    count,
    error: listError,
    loading: listLoading,
    hasMore,
    loadMore,
    reload,
    setParams,
  } = useInfinitePagination(listEmployees, {
    initialParams: { ordering: 'user__last_name' },
  });

  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(createInitialForm());
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [credentialsNotice, setCredentialsNotice] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState('');
  const [passwordInfo, setPasswordInfo] = useState(null);

  const observerRef = useRef(null);
  const sentinelRef = useCallback((node) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    if (!node) {
      return;
    }
    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !listLoading) {
        loadMore();
      }
    }, { rootMargin: '160px' });
    observerRef.current.observe(node);
  }, [hasMore, listLoading, loadMore]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  useEffect(() => {
    let cancelled = false;
    async function loadHierarchy() {
      setHierarchyLoading(true);
      setHierarchyError('');
      try {
        const [orgRes, deptRes, teamRes] = await Promise.all([
          listOrganizations({ params: { page_size: 200, ordering: 'name' } }),
          listDepartments({ params: { page_size: 500, ordering: 'name' } }),
          listTeams({ params: { page_size: 500, ordering: 'name' } }),
        ]);
        if (cancelled) {
          return;
        }
        setOrganizations(extractResults(orgRes));
        setDepartments(extractResults(deptRes));
        setTeams(extractResults(teamRes));
      } catch (err) {
        if (!cancelled) {
          console.error('Не удалось загрузить справочники для админ-панели', err);
          setHierarchyError('Не удалось загрузить справочники.');
        }
      } finally {
        if (!cancelled) {
          setHierarchyLoading(false);
        }
      }
    }
    loadHierarchy();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedDepartment('');
  }, [selectedOrganization]);

  useEffect(() => {
    setParams(() => ({
      ordering: 'user__last_name',
      search: debouncedSearch || undefined,
      department: selectedDepartment || undefined,
      role: selectedRole || undefined,
      'department__organization': selectedOrganization || undefined,
    }));
  }, [debouncedSearch, selectedDepartment, selectedRole, selectedOrganization, setParams]);

  const positionsByDepartment = useMemo(() => {
    return departments.reduce((map, dept) => {
      map.set(String(dept.id), Array.isArray(dept.positions) ? dept.positions : []);
      return map;
    }, new Map());
  }, [departments]);

  const teamsByDepartment = useMemo(() => {
    return teams.reduce((map, team) => {
      const key = team.department ? String(team.department) : '';
      if (!key) {
        return map;
      }
      const existing = map.get(key) || [];
      existing.push(team);
      map.set(key, existing);
      return map;
    }, new Map());
  }, [teams]);

  const availableDepartments = useMemo(() => {
    if (!selectedOrganization) {
      return departments;
    }
    return departments.filter((dept) => String(dept.organization) === String(selectedOrganization));
  }, [departments, selectedOrganization]);

  const departmentOptions = useMemo(() => departments.map((dept) => ({
    value: String(dept.id),
    label: dept.name,
    organization: dept.organization ? String(dept.organization) : '',
  })), [departments]);

  const organizationOptions = useMemo(() => organizations.map((org) => ({
    value: String(org.id),
    label: org.name,
  })), [organizations]);

  const totalLoadedManagers = useMemo(() => employees.filter((item) => item.is_manager).length, [employees]);

  const openCreateModal = () => {
    setCreateForm(createInitialForm());
    setCreateError('');
    setCredentialsNotice(null);
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
  };

  const handleCreateInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;
    setCreateForm((prev) => {
      if (name === 'organization') {
        return {
          ...prev,
          organization: nextValue,
          department: '',
          position: '',
          team: '',
        };
      }
      if (name === 'department') {
        return {
          ...prev,
          department: nextValue,
          position: '',
          team: '',
        };
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
      if (name === 'is_staff' && createForm.is_superuser) {
        return prev;
      }
      if (name === 'role' && createForm.is_superuser) {
        return prev;
      }
      return {
        ...prev,
        [name]: nextValue,
      };
    });
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    setCredentialsNotice(null);
    try {
      const payload = {
        first_name: createForm.first_name,
        last_name: createForm.last_name,
        email: createForm.email,
        username: createForm.username,
        hire_date: createForm.hire_date || undefined,
        department: createForm.department ? Number(createForm.department) : undefined,
        position: createForm.position ? Number(createForm.position) : undefined,
        team: createForm.team ? Number(createForm.team) : undefined,
        role: createForm.is_superuser ? 'admin' : createForm.role,
        is_superuser: createForm.is_superuser,
        is_staff: createForm.is_superuser ? true : createForm.is_staff,
        is_manager: createForm.role === 'manager',
      };
      const response = await adminCreateEmployee(payload);
      setCredentialsNotice({
        username: response.data.user.username,
        password: response.data.temporary_password,
        copied: false,
      });
      closeCreateModal();
      await reload();
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.detail || 'Не удалось создать сотрудника.';
      setCreateError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const openDrawer = useCallback(async (employeeId) => {
    setDrawerOpen(true);
    setDetail(null);
    setEditForm(null);
    setPasswordInfo(null);
    setDetailError('');
    setEditSuccess('');
    setDetailLoading(true);
    try {
      const response = await getEmployee(employeeId);
      setDetail(response.data);
      setEditForm(buildEditForm(response.data));
    } catch (err) {
      console.error('Не удалось загрузить данные сотрудника', err);
      setDetailError('Не удалось загрузить данные сотрудника.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDetail(null);
    setEditForm(null);
    setDetailError('');
    setEditSuccess('');
    setPasswordInfo(null);
  };

  const handleEditInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;
    setEditForm((prev) => {
      if (!prev) {
        return prev;
      }
      if (name === 'department') {
        return {
          ...prev,
          department: nextValue,
          position: '',
          team: '',
        };
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
      if (name === 'role' && prev.is_superuser) {
        return prev;
      }
      return {
        ...prev,
        [name]: nextValue,
      };
    });
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editForm?.id) {
      return;
    }
    setEditSaving(true);
    setEditSuccess('');
    setDetailError('');
    try {
      const payload = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        username: editForm.username,
        hire_date: editForm.hire_date || undefined,
        department: editForm.department ? Number(editForm.department) : undefined,
        position: editForm.position ? Number(editForm.position) : undefined,
        team: editForm.team ? Number(editForm.team) : undefined,
        role: editForm.is_superuser ? 'admin' : editForm.role,
        is_superuser: editForm.is_superuser,
        is_staff: editForm.is_superuser ? true : editForm.is_staff,
        is_manager: editForm.role === 'manager',
      };
      await updateEmployee(editForm.id, payload);
      setEditSuccess('Изменения сохранены.');
      await reload();
      await openDrawer(editForm.id);
    } catch (err) {
      const message = err.response?.data?.detail || 'Не удалось сохранить изменения.';
      setDetailError(message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!editForm?.id) {
      return;
    }
    if (!window.confirm('Удалить сотрудника? Действие необратимо.')) {
      return;
    }
    try {
      await deleteEmployee(editForm.id);
      closeDrawer();
      await reload();
    } catch (err) {
      console.error('Не удалось удалить сотрудника', err);
      setDetailError('Не удалось удалить сотрудника.');
    }
  };

  const handleResetPassword = async () => {
    if (!editForm?.id) {
      return;
    }
    try {
      const response = await resetEmployeePassword(editForm.id);
      setPasswordInfo(response.data);
    } catch (err) {
      console.error('Не удалось сгенерировать пароль', err);
      setDetailError('Не удалось сгенерировать пароль.');
    }
  };

  const handleCopyCredentials = async () => {
    if (!credentialsNotice?.password) {
      return;
    }
    try {
      await navigator.clipboard.writeText(credentialsNotice.password);
      setCredentialsNotice((prev) => (prev ? { ...prev, copied: true } : prev));
      setTimeout(() => {
        setCredentialsNotice((prev) => (prev ? { ...prev, copied: false } : prev));
      }, 2000);
    } catch (err) {
      console.error('Не удалось скопировать сгенерированный пароль', err);
      setCredentialsNotice((prev) => (prev ? { ...prev, copyError: true } : prev));
    }
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="admin-users-page">
      <header className="admin-users-header">
        <div>
          <p className="page-overline"><FiUsers size={14} /> Управление сотрудниками</p>
          <h1>Сотрудники организации</h1>
          <p className="page-subtitle">
            Управляйте учетными записями, иерархией и доступами сотрудников. Список загружается по мере прокрутки.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="ghost" onClick={reload} disabled={listLoading}>
            <FiRefreshCw size={16} /> Обновить
          </button>
          <button type="button" className="primary" onClick={openCreateModal}>
            <FiPlus size={16} /> Новый сотрудник
          </button>
        </div>
      </header>

      <section className="sync-callout" aria-live="polite">
        <div>
          <h2>Синхронизация сотрудников</h2>
          <p>
            Пользователи автоматически синхронизируются с 1C. Для ручных обновлений обратитесь к администратору
            интеграции.
          </p>
        </div>
        <button type="button" className="sync-badge" disabled>
          <FiRefreshCw size={16} /> Синхронизация активна
        </button>
      </section>

      {credentialsNotice && (
        <div className="page-banner success">
          <span>
            Учётная запись <strong>{credentialsNotice.username}</strong> создана. Пароль:
            {' '}
            <code>{credentialsNotice.password}</code>
          </span>
          <button type="button" className="ghost" onClick={handleCopyCredentials}>
            <FiCopy size={15} /> {credentialsNotice.copied ? 'Скопировано' : 'Скопировать'}
          </button>
          {credentialsNotice.copyError && (
            <span className="banner-hint">Не удалось скопировать автоматически, используйте ручной ввод.</span>
          )}
        </div>
      )}

      <section className="filters-panel">
        <div className="input-with-icon">
          <FiSearch size={16} />
          <input
            type="search"
            placeholder="Поиск по имени, почте или отделу"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="filters-grid">
          <label>
            <span>Организация</span>
            <select
              value={selectedOrganization}
              onChange={(event) => setSelectedOrganization(event.target.value)}
            >
              <option value="">Все организации</option>
              {organizationOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Отдел</span>
            <select
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value)}
              disabled={!availableDepartments.length}
            >
              <option value="">Все отделы</option>
              {availableDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Роль</span>
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
            >
              {ROLE_FILTER_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="filters-summary">
          <span>{typeof count === 'number' ? `${count} сотрудников` : 'Загружаем...'}</span>
          <span>{totalLoadedManagers} менеджеров в выборке</span>
        </div>
      </section>

      {(listError || hierarchyError) && (
        <div className="page-banner error">
          {listError ? 'Не удалось загрузить список сотрудников.' : hierarchyError}
        </div>
      )}

      <div className="admin-users-layout">
        <section className="employees-list">
          {hierarchyLoading && !employees.length ? (
            <div className="panel placeholder">Загружаем справочники…</div>
          ) : employees.length === 0 && !listLoading ? (
            <div className="panel empty">Сотрудники не найдены.</div>
          ) : (
            employees.map((employee) => (
              <article
                key={employee.id}
                className="employee-card"
                onClick={() => openDrawer(employee.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    openDrawer(employee.id);
                  }
                }}
              >
                <header>
                  <div>
                    <strong>{employee.full_name || employee.username}</strong>
                    <p>{formatEmployeeSubtitle(employee)}</p>
                  </div>
                  <div className="badge-set">
                    {employee.user_is_superuser && <span className="badge danger">Суперпользователь</span>}
                    {employee.role && ROLE_BADGES[employee.role] && (
                      <span className="badge accent">{ROLE_BADGES[employee.role]}</span>
                    )}
                    {employee.is_manager && !employee.user_is_superuser && (
                      <span className="badge success">Руководитель</span>
                    )}
                  </div>
                </header>
                <footer>
                  {employee.email && (
                    <span><FiMail size={14} /> {employee.email}</span>
                  )}
                  {employee.team_name ? (
                    <span><FiUsers size={14} /> {employee.team_name}</span>
                  ) : (
                    <span><FiMapPin size={14} /> {employee.department_name || 'Без отдела'}</span>
                  )}
                </footer>
              </article>
            ))
          )}
          <div ref={sentinelRef} className="sentinel" />
          {listLoading && employees.length > 0 && <div className="list-loader">Подгружаем…</div>}
        </section>

        {drawerOpen && (
          <aside className="employee-drawer">
            <div className="drawer-header">
              <button type="button" className="icon" onClick={closeDrawer}>
                <FiX size={18} />
              </button>
              <div>
                <h2>{detail?.user?.get_full_name || detail?.full_name || 'Карточка сотрудника'}</h2>
                {detail && (
                  <p>
                    <FiBriefcase size={14} /> {formatEmployeeSubtitle(detail)}
                  </p>
                )}
              </div>
            </div>

            {detailLoading ? (
              <div className="drawer-placeholder">Загружаем данные сотрудника…</div>
            ) : detailError ? (
              <div className="drawer-error">{detailError}</div>
            ) : detail && editForm ? (
              <form className="drawer-form" onSubmit={handleEditSubmit}>
                <div className="form-grid">
                  <label>
                    <span>Имя</span>
                    <input
                      type="text"
                      name="first_name"
                      value={editForm.first_name}
                      onChange={handleEditInputChange}
                    />
                  </label>
                  <label>
                    <span>Фамилия</span>
                    <input
                      type="text"
                      name="last_name"
                      value={editForm.last_name}
                      onChange={handleEditInputChange}
                    />
                  </label>
                  <label>
                    <span>Почта</span>
                    <input
                      type="email"
                      name="email"
                      value={editForm.email}
                      onChange={handleEditInputChange}
                    />
                  </label>
                  <label>
                    <span>Имя пользователя</span>
                    <input
                      type="text"
                      name="username"
                      value={editForm.username}
                      onChange={handleEditInputChange}
                    />
                  </label>
                  <label>
                    <span>Дата приема</span>
                    <input
                      type="date"
                      name="hire_date"
                      value={editForm.hire_date || ''}
                      onChange={handleEditInputChange}
                    />
                  </label>
                  <label>
                    <span>Отдел</span>
                    <select
                      name="department"
                      value={editForm.department}
                      onChange={handleEditInputChange}
                    >
                      <option value="">Не назначен</option>
                      {departmentOptions.map((dept) => (
                        <option key={dept.value} value={dept.value}>{dept.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Должность</span>
                    <select
                      name="position"
                      value={editForm.position}
                      onChange={handleEditInputChange}
                    >
                      <option value="">Свободная форма</option>
                      {(positionsByDepartment.get(editForm.department || '') || []).map((position) => (
                        <option key={position.id} value={position.id}>{position.title}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Команда</span>
                    <select
                      name="team"
                      value={editForm.team}
                      onChange={handleEditInputChange}
                    >
                      <option value="">Без команды</option>
                      {(teamsByDepartment.get(editForm.department || '') || []).map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </label>
                  {!editForm.is_superuser && (
                    <label>
                      <span>Роль</span>
                      <select
                        name="role"
                        value={editForm.role}
                        onChange={handleEditInputChange}
                      >
                        {ROLE_SELECT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="form-flags">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="is_superuser"
                      checked={editForm.is_superuser}
                      onChange={handleEditInputChange}
                    />
                    <span><FiShield size={14} /> Суперпользователь</span>
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="is_staff"
                      checked={editForm.is_superuser ? true : editForm.is_staff}
                      onChange={handleEditInputChange}
                      disabled={editForm.is_superuser}
                    />
                    <span>Персонал</span>
                  </label>
                </div>

                {editSuccess && <div className="drawer-success">{editSuccess}</div>}

                <div className="drawer-actions">
                  <button type="submit" className="primary" disabled={editSaving}>
                    {editSaving ? 'Сохраняем…' : 'Сохранить изменения'}
                  </button>
                  <button type="button" className="ghost" onClick={handleResetPassword}>
                    <FiLock size={14} /> Сгенерировать пароль
                  </button>
                  <button type="button" className="danger" onClick={handleDeleteEmployee}>
                    <FiTrash2 size={14} /> Удалить
                  </button>
                </div>

                {passwordInfo && (
                  <div className="password-hint">
                    <p>Временные данные для входа:</p>
                    <code>{passwordInfo.username} / {passwordInfo.temporary_password}</code>
                  </div>
                )}
              </form>
            ) : null}
          </aside>
        )}
      </div>

      {createModalOpen && (
        <div className="modal-backdrop" onClick={closeCreateModal} role="presentation">
          <div className="modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Новый сотрудник</h2>
              <button type="button" className="icon" onClick={closeCreateModal}>
                <FiX size={18} />
              </button>
            </div>
            <form className="modal-body" onSubmit={handleCreateSubmit}>
              <div className="form-grid">
                <label>
                  <span>Имя</span>
                  <input
                    type="text"
                    name="first_name"
                    value={createForm.first_name}
                    onChange={handleCreateInputChange}
                    required
                  />
                </label>
                <label>
                  <span>Фамилия</span>
                  <input
                    type="text"
                    name="last_name"
                    value={createForm.last_name}
                    onChange={handleCreateInputChange}
                    required
                  />
                </label>
                <label>
                  <span>Почта</span>
                  <input
                    type="email"
                    name="email"
                    value={createForm.email}
                    onChange={handleCreateInputChange}
                    required
                  />
                </label>
                <label>
                  <span>Имя пользователя</span>
                  <input
                    type="text"
                    name="username"
                    value={createForm.username}
                    onChange={handleCreateInputChange}
                    placeholder="Создастся автоматически, если оставить пустым"
                  />
                </label>
                <label>
                  <span>Дата приема</span>
                  <input
                    type="date"
                    name="hire_date"
                    value={createForm.hire_date}
                    onChange={handleCreateInputChange}
                  />
                </label>
                <label>
                  <span>Организация</span>
                  <select
                    name="organization"
                    value={createForm.organization}
                    onChange={handleCreateInputChange}
                  >
                    <option value="">Не выбрана</option>
                    {organizationOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Отдел</span>
                  <select
                    name="department"
                    value={createForm.department}
                    onChange={handleCreateInputChange}
                    required
                  >
                    <option value="">Выберите отдел</option>
                    {departmentOptions
                      .filter((dept) => !createForm.organization || dept.organization === createForm.organization)
                      .map((dept) => (
                        <option key={dept.value} value={dept.value}>{dept.label}</option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>Должность</span>
                  <select
                    name="position"
                    value={createForm.position}
                    onChange={handleCreateInputChange}
                  >
                    <option value="">Свободная форма</option>
                    {(positionsByDepartment.get(createForm.department || '') || []).map((position) => (
                      <option key={position.id} value={position.id}>{position.title}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Команда</span>
                  <select
                    name="team"
                    value={createForm.team}
                    onChange={handleCreateInputChange}
                  >
                    <option value="">Без команды</option>
                    {(teamsByDepartment.get(createForm.department || '') || []).map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </label>
                {!createForm.is_superuser && (
                  <label>
                    <span>Роль</span>
                    <select
                      name="role"
                      value={createForm.role}
                      onChange={handleCreateInputChange}
                    >
                      {ROLE_SELECT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="form-flags">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="is_superuser"
                    checked={createForm.is_superuser}
                    onChange={handleCreateInputChange}
                  />
                  <span><FiShield size={14} /> Суперпользователь</span>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="is_staff"
                    checked={createForm.is_superuser ? true : createForm.is_staff}
                    onChange={handleCreateInputChange}
                    disabled={createForm.is_superuser}
                  />
                  <span>Персонал</span>
                </label>
              </div>

              {createError && <div className="drawer-error">{createError}</div>}

              <div className="modal-actions">
                <button type="button" className="ghost" onClick={closeCreateModal}>
                  Отмена
                </button>
                <button type="submit" className="primary" disabled={createLoading}>
                  {createLoading ? 'Создаем…' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsers;
