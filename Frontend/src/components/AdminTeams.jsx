import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  FiGitBranch,
  FiLayers,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import {
  createTeam,
  deleteTeam,
  listDepartments,
  listTeams,
  updateTeam,
} from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import './AdminTeams.css';

const createInitialForm = () => ({
  id: null,
  name: '',
  description: '',
  department: '',
  parent: '',
});

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

function AdminTeams() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_superuser);

  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(createInitialForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    const loadAll = async () => {
      setLoading(true);
      setError('');
      try {
        const [teamsRes, deptRes] = await Promise.all([
          listTeams({ params: { page_size: 500, ordering: 'name' } }),
          listDepartments({ params: { page_size: 500, ordering: 'name' } }),
        ]);
        setTeams(extractResults(teamsRes));
        setDepartments(extractResults(deptRes));
      } catch (err) {
        console.error('Не удалось загрузить команды', err);
        setError('Не удалось загрузить команды. Попробуйте позже.');
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [isAdmin]);

  const departmentMap = useMemo(() => {
    return departments.reduce((acc, dept) => {
      acc.set(String(dept.id), dept);
      return acc;
    }, new Map());
  }, [departments]);

  const teamsByDepartment = useMemo(() => {
    return teams.reduce((acc, team) => {
      const key = team.department ? String(team.department) : '';
      if (!key) {
        return acc;
      }
      const bucket = acc.get(key) || [];
      bucket.push(team);
      acc.set(key, bucket);
      return acc;
    }, new Map());
  }, [teams]);

  const filteredTeams = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      return teams;
    }
    return teams.filter((team) => {
      const departmentName = team.department_name?.toLowerCase?.() || '';
      return [team.name?.toLowerCase?.() || '', team.description?.toLowerCase?.() || '', departmentName].some(
        (value) => value.includes(query),
      );
    });
  }, [teams, debouncedSearch]);

  const openModal = (team = createInitialForm()) => {
    setForm({
      id: team.id ?? null,
      name: team.name ?? '',
      description: team.description ?? '',
      department: team.department ? String(team.department) : '',
      parent: team.parent ? String(team.parent) : '',
    });
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(createInitialForm());
    setSaving(false);
    setError('');
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === 'department') {
        return {
          ...prev,
          department: value,
          parent: '',
        };
      }
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const reloadData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await listTeams({ params: { page_size: 500, ordering: 'name' } });
      setTeams(extractResults(response));
    } catch (err) {
      console.error('Не удалось обновить список команд', err);
      setError('Не удалось обновить список команд.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Введите название команды.');
      return;
    }
    if (!form.department) {
      setError('Выберите отдел для команды.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      department: form.department ? Number(form.department) : undefined,
      parent: form.parent ? Number(form.parent) : undefined,
    };

    try {
      if (form.id) {
        await updateTeam(form.id, payload);
        setSuccess('Команда обновлена.');
      } else {
        await createTeam(payload);
        setSuccess('Команда создана.');
      }
      closeModal();
      await reloadData();
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.name?.[0] ||
        err.response?.data?.detail ||
        'Не удалось сохранить команду.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (team) => {
    if (!team?.id) {
      return;
    }
    const confirmed = window.confirm('Удалить команду? Сотрудники останутся в отделе без команды.');
    if (!confirmed) {
      return;
    }
    try {
      await deleteTeam(team.id);
      setSuccess('Команда удалена.');
      await reloadData();
    } catch (err) {
      console.error('Не удалось удалить команду', err);
      setError('Удалить команду не удалось.');
    }
  };

  const parentOptions = useMemo(() => {
    if (!form.department) {
      return [];
    }
    return (teamsByDepartment.get(form.department) || []).filter((team) => String(team.id) !== String(form.id));
  }, [teamsByDepartment, form.department, form.id]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="admin-teams-page">
      <header className="admin-teams-header">
        <div>
          <p className="page-overline"><FiGitBranch size={14} /> Управление командами</p>
          <h1>Команды компании</h1>
          <p className="page-subtitle">
            Формируйте проектные и функциональные команды, назначайте руководителей и иерархию вложенности.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="ghost" onClick={reloadData} disabled={loading}>
            <FiRefreshCw size={16} /> Обновить
          </button>
          <button type="button" className="primary" onClick={() => openModal()}>
            <FiPlus size={16} /> Новая команда
          </button>
        </div>
      </header>

      <section className="filters-panel">
        <div className="input-with-icon">
          <FiSearch size={16} />
          <input
            type="search"
            placeholder="Поиск по названию или отделу"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="filters-summary">
          <span>{teams.length} команд</span>
          <span>{departments.length} отделов</span>
        </div>
      </section>

      {error && <div className="page-banner error">{error}</div>}
      {success && <div className="page-banner success">{success}</div>}

      <section className="teams-grid">
        {loading ? (
          <div className="panel placeholder">Загружаем команды…</div>
        ) : filteredTeams.length === 0 ? (
          <div className="panel empty">Команды ещё не созданы.</div>
        ) : (
          filteredTeams.map((team) => {
            const department = departmentMap.get(String(team.department));
            const parentTeam = teams.find((item) => item.id === team.parent);
            return (
              <article key={team.id} className="team-card">
                <header>
                  <div>
                    <strong>{team.name}</strong>
                    <p>{department?.name || 'Без отдела'}</p>
                  </div>
                  <div className="card-actions">
                    <button type="button" className="ghost" onClick={() => openModal(team)}>
                      <FiLayers size={15} /> Редактировать
                    </button>
                    <button type="button" className="danger" onClick={() => handleDelete(team)}>
                      <FiTrash2 size={15} /> Удалить
                    </button>
                  </div>
                </header>
                {team.description && <p className="team-description">{team.description}</p>}
                <footer>
                  <span><FiUsers size={14} /> Менеджер: {team.manager_name || 'Не назначен'}</span>
                  {parentTeam && <span><FiGitBranch size={14} /> Родитель: {parentTeam.name}</span>}
                </footer>
              </article>
            );
          })
        )}
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{form.id ? 'Редактировать команду' : 'Новая команда'}</h2>
              <button type="button" className="icon" onClick={closeModal}>
                <FiX size={18} />
              </button>
            </div>
            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label>
                  <span>Название *</span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Например, Команда продукта"
                    required
                  />
                </label>
                <label>
                  <span>Отдел *</span>
                  <select
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Выберите отдел</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Родительская команда</span>
                  <select
                    name="parent"
                    value={form.parent}
                    onChange={handleChange}
                    disabled={!form.department}
                  >
                    <option value="">Не выбрана</option>
                    {parentOptions.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>Описание</span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Кратко опишите задачи команды"
                />
              </label>

              {error && <div className="drawer-error">{error}</div>}

              <div className="modal-actions">
                <button type="button" className="ghost" onClick={closeModal}>
                  Отмена
                </button>
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? 'Сохраняем…' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminTeams;
