import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FiEdit2, FiLayers, FiPlus, FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi';
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  updateDepartment,
} from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import './AdminDepartments.css';

const DEFAULT_FORM = { id: null, name: '', description: '' };

function AdminDepartments() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_superuser);

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const loadDepartments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getDepartments();
      const data = Array.isArray(response.data?.results)
        ? response.data.results
        : response.data;
      setDepartments(data || []);
    } catch (err) {
      console.error('Не удалось загрузить отделы', err);
      setError('Не удалось загрузить отделы. Попробуйте позже.');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadDepartments();
    }
  }, [isAdmin]);

  const openModal = (department = DEFAULT_FORM) => {
    setForm({
      id: department.id ?? null,
      name: department.name ?? '',
      description: department.description ?? '',
    });
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(DEFAULT_FORM);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (form.id) {
        await updateDepartment(form.id, {
          name: form.name,
          description: form.description,
        });
        setSuccess('Отдел успешно обновлён.');
      } else {
        await createDepartment({
          name: form.name,
          description: form.description,
        });
        setSuccess('Отдел успешно создан.');
      }
      closeModal();
      await loadDepartments();
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.name?.[0] ||
        'Не удалось сохранить отдел. Проверьте данные.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (department) => {
    const confirmed = window.confirm(
      'Удалить отдел? Сотрудники останутся без привязки к отделу.'
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteDepartment(department.id);
      setSuccess('Отдел удалён.');
      await loadDepartments();
    } catch (err) {
      console.error('Не удалось удалить отдел', err);
      setError('Удалить отдел не удалось. Убедитесь, что доступ разрешён.');
    }
  };

  const totalEmployees = useMemo(
    () => departments.reduce((sum, dept) => sum + (dept.employees_count || 0), 0),
    [departments]
  );

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="page admin-page">
      <header className="page-header">
        <div>
          <p className="page-overline">
            <FiLayers size={14} /> Управление отделами
          </p>
          <h1>Структура компании</h1>
          <p className="page-subtitle">
            Создавайте и обновляйте отделы, чтобы назначать их сотрудникам и выстраивать оргструктуру
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn ghost" onClick={loadDepartments} disabled={loading}>
            <FiRefreshCw size={16} /> Обновить
          </button>
          <button type="button" className="btn primary" onClick={() => openModal()}>
            <FiPlus size={16} /> Новый отдел
          </button>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}
      {success && <div className="page-banner success">{success}</div>}

      <section className="panel">
        <header className="panel-header">
          <div>
            <p className="panel-overline">Всего отделов: {departments.length}</p>
            <h2>Список отделов</h2>
          </div>
          <div className="panel-badges">
            <span className="badge">Сотрудников: {totalEmployees}</span>
          </div>
        </header>

        <div className="table-wrapper">
          {loading ? (
            <div className="table-placeholder">Загружаем отделы…</div>
          ) : departments.length === 0 ? (
            <div className="table-placeholder empty">Отделы ещё не заведены.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Сотрудников</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.id}>
                    <td>
                      <strong>{department.name}</strong>
                    </td>
                    <td>{department.description || '—'}</td>
                    <td>{department.employees_count || 0}</td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => openModal(department)}
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => handleDelete(department)}
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal medium">
            <header className="modal-header">
              <h2>{form.id ? 'Редактировать отдел' : 'Новый отдел'}</h2>
              <button type="button" className="modal-close" onClick={closeModal}>
                <FiX size={18} />
              </button>
            </header>
            <form className="modal-body" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Название *</span>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Например, Отдел разработки"
                  required
                  disabled={saving}
                />
              </label>
              <label className="form-field">
                <span>Описание</span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Опишите задачи и направление отдела"
                  disabled={saving}
                />
              </label>
              <footer className="modal-footer">
                <button type="button" className="btn ghost" onClick={closeModal} disabled={saving}>
                  Отмена
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? 'Сохраняем…' : form.id ? 'Сохранить изменения' : 'Создать отдел'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDepartments;
