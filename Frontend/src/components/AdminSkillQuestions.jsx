import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiFilter,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSliders,
  FiX,
  FiEdit3,
  FiTrash2,
  FiDatabase,
} from 'react-icons/fi';
import {
  createSkillQuestion,
  deleteSkillQuestion,
  listDepartments,
  listSkillQuestions,
  updateSkillQuestion,
} from '../api/services';
import useDebouncedValue from '../hooks/useDebouncedValue';
import './AdminSkillQuestions.css';

const ANSWER_TYPE_LABELS = {
  scale: 'Шкала',
  numeric: 'Числовой ответ',
  single_choice: 'Выбор варианта',
  boolean: 'Да/Нет',
};

const CONTEXT_LABELS = {
  self: 'Самооценка',
  peer: 'Оценка 360',
  both: 'Самооценка и 360',
};

const SKILL_TYPE_LABELS = {
  hard: 'Hard skills',
  soft: 'Soft skills',
};

const DEFAULT_FORM = {
  id: null,
  category: '',
  question_text: '',
  grade_description: '',
  context: 'both',
  answer_type: 'scale',
  scale_min: 0,
  scale_max: 10,
  weight: 1,
  difficulty: '',
  answer_options: '',
  correct_answer: '',
  tolerance: 0,
  is_active: true,
  departments: [],
};

const buildCategory = (question) => ({
  id: question.category,
  name: question.category_name,
  skillType: question.skill_type,
});

function AdminSkillQuestions() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    context: 'all',
    skillType: 'all',
    isActive: 'active',
    department: 'all',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [removingId, setRemovingId] = useState(null);

  const debouncedSearch = useDebouncedValue(filters.search, 250);

  const refreshQuestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page_size: 500,
        ordering: 'category__skill_type,category__name,-is_active,question_text',
      };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (filters.context !== 'all') {
        params.context = filters.context;
      }
      if (filters.skillType !== 'all') {
        params['category__skill_type'] = filters.skillType;
      }
      if (filters.isActive === 'inactive') {
        params.is_active = false;
      } else if (filters.isActive === 'active') {
        params.is_active = true;
      }
      if (filters.department !== 'all') {
        params.departments = filters.department;
      }

      const response = await listSkillQuestions({ params });
      const payload = response?.data;
      const items = Array.isArray(payload?.results)
        ? payload.results
        : Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data?.results)
        ? payload.data.results
        : [];
      setQuestions(items);
    } catch (err) {
      console.error('Не удалось загрузить вопросы навыков', err);
      setQuestions([]);
      setError('Не удалось загрузить вопросы. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters.context, filters.department, filters.isActive, filters.skillType]);

  useEffect(() => {
    refreshQuestions();
  }, [refreshQuestions]);

  useEffect(() => {
    let cancelled = false;
    async function loadDeps() {
      try {
        const response = await listDepartments({ params: { page_size: 500, ordering: 'name' } });
        if (cancelled) {
          return;
        }
        const payload = response?.data;
        const items = Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data?.results)
          ? payload.data.results
          : [];
        setDepartments(items);
      } catch (err) {
        if (!cancelled) {
          console.error('Не удалось загрузить отделы', err);
        }
      }
    }
    loadDeps();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const unique = new Map();
    questions.forEach((question) => {
      if (!question?.category) {
        return;
      }
      const key = String(question.category);
      if (!unique.has(key)) {
        unique.set(key, buildCategory(question));
      }
    });
    return Array.from(unique.values()).sort((a, b) => {
      if (a.skillType === b.skillType) {
        return a.name.localeCompare(b.name);
      }
      return a.skillType.localeCompare(b.skillType);
    });
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((question) => {
      if (filters.skillType !== 'all' && question.skill_type !== filters.skillType) {
        return false;
      }
      if (filters.context !== 'all' && question.context !== filters.context) {
        return false;
      }
      if (filters.isActive === 'active' && question.is_active === false) {
        return false;
      }
      if (filters.isActive === 'inactive' && question.is_active !== false) {
        return false;
      }
      if (filters.department !== 'all') {
        const hasDepartment = Array.isArray(question.departments)
          ? question.departments.includes(Number(filters.department))
          : Array.isArray(question.departments)
          ? question.departments.some((dept) => Number(dept) === Number(filters.department))
          : false;
        if (!hasDepartment) {
          return false;
        }
      }
      if (debouncedSearch) {
        const query = debouncedSearch.trim().toLowerCase();
        const haystack = `${question.question_text} ${question.grade_description}`.toLowerCase();
        return haystack.includes(query);
      }
      return true;
    });
  }, [questions, filters.skillType, filters.context, filters.isActive, filters.department, debouncedSearch]);

  const openCreateModal = () => {
    setFormState(DEFAULT_FORM);
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (question) => {
    setFormState({
      id: question.id,
      category: question.category ? String(question.category) : '',
      question_text: question.question_text || '',
      grade_description: question.grade_description || '',
      context: question.context || 'both',
      answer_type: question.answer_type || 'scale',
      scale_min: question.scale_min ?? 0,
      scale_max: question.scale_max ?? 10,
      weight: question.weight ?? 1,
      difficulty: question.difficulty || '',
      answer_options: Array.isArray(question.answer_options)
        ? question.answer_options.join('\n')
        : '',
      correct_answer:
        question.answer_type === 'single_choice'
          ? typeof question.correct_answer === 'string'
            ? question.correct_answer
            : Array.isArray(question.correct_answer)
            ? question.correct_answer[0] || ''
            : ''
          : question.answer_type === 'numeric'
          ? question.correct_answer ?? ''
          : question.answer_type === 'boolean'
          ? question.correct_answer === true
            ? 'true'
            : question.correct_answer === false
            ? 'false'
            : ''
          : '',
      tolerance: question.tolerance ?? 0,
      is_active: question.is_active !== false,
      departments: Array.isArray(question.departments)
        ? question.departments.map((deptId) => String(deptId))
        : Array.isArray(question.department_options)
        ? question.department_options.map((dept) => String(dept.id))
        : [],
    });
    setFormError('');
    setFormOpen(true);
  };

  const closeModal = () => {
    if (formSubmitting) {
      return;
    }
    setFormOpen(false);
    setFormState(DEFAULT_FORM);
    setFormError('');
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked, options } = event.target;
    if (name === 'departments' && options) {
      const selected = Array.from(options)
        .filter((option) => option.selected)
        .map((option) => option.value);
      setFormState((prev) => ({ ...prev, departments: selected }));
      return;
    }
    const nextValue = type === 'checkbox' ? checked : value;
    setFormState((prev) => ({ ...prev, [name]: nextValue }));
  };

  const parseOptions = (input) => {
    if (!input) {
      return [];
    }
    return input
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const parseCorrectAnswer = (answerType, value) => {
    if (!value && value !== 0) {
      return null;
    }
    if (answerType === 'numeric') {
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (answerType === 'boolean') {
      if (value === true || value === 'true' || value === '1' || value === 1) {
        return true;
      }
      if (value === false || value === 'false' || value === '0' || value === 0) {
        return false;
      }
      return null;
    }
    return value;
  };

  const handleSubmitForm = async (event) => {
    event.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    const payload = {
      category: formState.category ? Number(formState.category) : null,
      question_text: formState.question_text.trim(),
      grade_description: formState.grade_description.trim(),
      context: formState.context,
      answer_type: formState.answer_type,
      scale_min: Number(formState.scale_min ?? 0),
      scale_max: Number(formState.scale_max ?? 10),
      weight: Number(formState.weight ?? 1),
      difficulty: formState.difficulty.trim(),
      tolerance: Number(formState.tolerance ?? 0),
      is_active: Boolean(formState.is_active),
      departments: formState.departments.map((deptId) => Number(deptId)),
    };

    if (!payload.category) {
      setFormError('Выберите категорию.');
      setFormSubmitting(false);
      return;
    }

    if (!payload.question_text) {
      setFormError('Введите текст вопроса.');
      setFormSubmitting(false);
      return;
    }

    if (payload.answer_type === 'scale' && payload.scale_max <= payload.scale_min) {
      setFormError('Диапазон шкалы указан некорректно.');
      setFormSubmitting(false);
      return;
    }

    if (payload.answer_type === 'single_choice') {
      const options = parseOptions(formState.answer_options);
      if (options.length === 0) {
        setFormError('Добавьте варианты ответов.');
        setFormSubmitting(false);
        return;
      }
      payload.answer_options = options;
      const correct = parseCorrectAnswer('single_choice', formState.correct_answer?.trim());
      if (correct && !options.includes(correct)) {
        setFormError('Правильный ответ должен быть в списке вариантов.');
        setFormSubmitting(false);
        return;
      }
      payload.correct_answer = correct;
    } else if (payload.answer_type === 'numeric') {
      payload.answer_options = [];
      payload.correct_answer = parseCorrectAnswer('numeric', formState.correct_answer);
      payload.tolerance = Number(formState.tolerance ?? 0);
    } else if (payload.answer_type === 'boolean') {
      payload.answer_options = [];
      payload.correct_answer = parseCorrectAnswer('boolean', formState.correct_answer);
    } else {
      payload.answer_options = [];
      payload.correct_answer = null;
    }

    try {
      if (formState.id) {
        await updateSkillQuestion(formState.id, payload);
      } else {
        await createSkillQuestion(payload);
      }
      closeModal();
      await refreshQuestions();
    } catch (err) {
      console.error('Не удалось сохранить вопрос', err);
      const resp = err?.response?.data;
      const message = resp?.message || resp?.detail;
      if (message) {
        setFormError(message);
      } else if (resp && typeof resp === 'object') {
        const firstError = Object.values(resp)[0];
        setFormError(Array.isArray(firstError) ? firstError[0] : String(firstError));
      } else {
        setFormError('Не удалось сохранить вопрос. Попробуйте позже.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (question) => {
    if (!question?.id) {
      return;
    }
    const confirmed = window.confirm('Удалить этот вопрос? Действие необратимо.');
    if (!confirmed) {
      return;
    }
    setRemovingId(question.id);
    try {
      await deleteSkillQuestion(question.id);
      await refreshQuestions();
    } catch (err) {
      console.error('Не удалось удалить вопрос', err);
      alert('Не удалось удалить вопрос. Попробуйте позже.');
    } finally {
      setRemovingId(null);
    }
  };

  const departmentOptions = useMemo(() => {
    return departments.map((dept) => ({
      value: String(dept.id),
      label: dept.name,
    }));
  }, [departments]);

  const activeFilters = filters.context !== 'all' || filters.skillType !== 'all' || filters.isActive !== 'active' || filters.department !== 'all' || Boolean(debouncedSearch);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Редактор вопросов по навыкам</h1>
          <p className="page-subtitle">
            Управляйте банком вопросов для самооценки и 360. Настраивайте типы ответов, точность и доступность для отделов.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn ghost" onClick={refreshQuestions} disabled={loading}>
            <FiRefreshCw size={16} /> Обновить
          </button>
          <button type="button" className="btn primary" onClick={openCreateModal}>
            <FiPlus size={16} /> Новый вопрос
          </button>
        </div>
      </header>

      <section className="page-section">
        <div className="filters">
          <div className="input-with-icon">
            <FiSearch size={16} />
            <input
              type="search"
              placeholder="Поиск по тексту вопроса"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
          </div>
          <div className="filter-group">
            <FiFilter size={14} />
            <select
              value={filters.skillType}
              onChange={(event) => setFilters((prev) => ({ ...prev, skillType: event.target.value }))}
            >
              <option value="all">Все навыки</option>
              <option value="hard">Hard skills</option>
              <option value="soft">Soft skills</option>
            </select>
            <select
              value={filters.context}
              onChange={(event) => setFilters((prev) => ({ ...prev, context: event.target.value }))}
            >
              <option value="all">Все контексты</option>
              <option value="self">Самооценка</option>
              <option value="peer">Оценка 360</option>
              <option value="both">Самооценка и 360</option>
            </select>
            <select
              value={filters.isActive}
              onChange={(event) => setFilters((prev) => ({ ...prev, isActive: event.target.value }))}
            >
              <option value="active">Активные</option>
              <option value="all">Все</option>
              <option value="inactive">Архив</option>
            </select>
            <select
              value={filters.department}
              onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value }))}
            >
              <option value="all">Все отделы</option>
              {departmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error && <div className="page-banner error">{error}</div>}

      <section className="page-section">
        <div className="question-grid">
          {loading ? (
            <div className="panel placeholder">Загружаем вопросы…</div>
          ) : filteredQuestions.length === 0 ? (
            <div className="panel empty">
              <p>По выбранным условиям вопросов нет.</p>
              {activeFilters && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() =>
                    setFilters({ search: '', context: 'all', skillType: 'all', isActive: 'active', department: 'all' })
                  }
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            filteredQuestions.map((question) => (
              <article key={question.id} className={`panel question-card ${question.is_active ? '' : 'inactive'}`}>
                <header className="question-card-header">
                  <div>
                    <span className="question-chip">
                      {SKILL_TYPE_LABELS[question.skill_type] || question.skill_type}
                    </span>
                    <span className={`question-chip context-${question.context}`}>
                      {CONTEXT_LABELS[question.context] || question.context_display || question.context}
                    </span>
                  </div>
                  <span className="question-answer-type">
                    <FiSliders size={14} /> {ANSWER_TYPE_LABELS[question.answer_type] || question.answer_type}
                  </span>
                </header>
                <div className="question-body">
                  <h2>{question.question_text}</h2>
                  <p className="question-description">{question.grade_description || '—'}</p>
                  <div className="question-meta">
                    <div>
                      <small>Категория</small>
                      <strong>{question.category_name}</strong>
                    </div>
                    <div>
                      <small>Вес</small>
                      <strong>{question.weight}</strong>
                    </div>
                    <div>
                      <small>Сложность</small>
                      <strong>{question.difficulty || '—'}</strong>
                    </div>
                  </div>
                  {question.answer_type === 'scale' && (
                    <p className="question-range">Диапазон: {question.scale_min} – {question.scale_max}</p>
                  )}
                  {question.answer_type === 'numeric' && (
                    <p className="question-range">Допуск ±{Number(question.tolerance).toFixed(2)}</p>
                  )}
                  {question.answer_type === 'single_choice' && Array.isArray(question.answer_options) && (
                    <ul className="question-options">
                      {question.answer_options.map((option) => (
                        <li key={option}>{option}</li>
                      ))}
                    </ul>
                  )}
                  {Array.isArray(question.department_options) && question.department_options.length > 0 && (
                    <div className="question-tags">
                      {question.department_options.map((dept) => (
                        <span key={dept.id} className="tag muted">
                          {dept.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <footer className="question-card-footer">
                  <span className="question-updated">
                    Обновлено {new Date(question.updated_at || question.created_at).toLocaleDateString('ru-RU')}
                  </span>
                  <div className="question-actions">
                    <button type="button" className="icon-btn" onClick={() => openEditModal(question)}>
                      <FiEdit3 size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleDeleteQuestion(question)}
                      disabled={removingId === question.id}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </footer>
              </article>
            ))
          )}
        </div>
      </section>

      {formOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <header className="modal-header">
              <h2>{formState.id ? 'Редактировать вопрос' : 'Создать вопрос'}</h2>
              <button type="button" className="icon-btn" onClick={closeModal} aria-label="Закрыть">
                <FiX size={18} />
              </button>
            </header>

            {formError && <div className="modal-banner error">{formError}</div>}

            <form onSubmit={handleSubmitForm} className="modal-form">
              <label className="form-field">
                <span>Категория</span>
                <select name="category" value={formState.category} onChange={handleFormChange} required>
                  <option value="">Выберите категорию</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {SKILL_TYPE_LABELS[category.skillType] || category.skillType} • {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-row">
                <label className="form-field">
                  <span>Контекст</span>
                  <select name="context" value={formState.context} onChange={handleFormChange}>
                    <option value="self">Самооценка</option>
                    <option value="peer">Оценка 360</option>
                    <option value="both">Самооценка и 360</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Тип ответа</span>
                  <select name="answer_type" value={formState.answer_type} onChange={handleFormChange}>
                    <option value="scale">Шкала</option>
                    <option value="numeric">Числовой ответ</option>
                    <option value="single_choice">Выбор варианта</option>
                    <option value="boolean">Да/Нет</option>
                  </select>
                </label>
              </div>

              <label className="form-field">
                <span>Текст вопроса</span>
                <textarea
                  name="question_text"
                  value={formState.question_text}
                  onChange={handleFormChange}
                  rows={3}
                  required
                />
              </label>

              <label className="form-field">
                <span>Описание шкалы / критерии</span>
                <textarea
                  name="grade_description"
                  value={formState.grade_description}
                  onChange={handleFormChange}
                  rows={3}
                />
              </label>

              <div className="form-row">
                <label className="form-field">
                  <span>Вес вопроса</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    name="weight"
                    value={formState.weight}
                    onChange={handleFormChange}
                  />
                </label>
                <label className="form-field">
                  <span>Сложность</span>
                  <input
                    type="text"
                    name="difficulty"
                    value={formState.difficulty}
                    onChange={handleFormChange}
                    placeholder="Например, Базовый"
                  />
                </label>
              </div>

              {formState.answer_type === 'scale' && (
                <div className="form-row">
                  <label className="form-field">
                    <span>Минимум</span>
                    <input
                      type="number"
                      name="scale_min"
                      value={formState.scale_min}
                      onChange={handleFormChange}
                    />
                  </label>
                  <label className="form-field">
                    <span>Максимум</span>
                    <input
                      type="number"
                      name="scale_max"
                      value={formState.scale_max}
                      onChange={handleFormChange}
                    />
                  </label>
                </div>
              )}

              {formState.answer_type === 'numeric' && (
                <div className="form-row">
                  <label className="form-field">
                    <span>Правильный ответ (опционально)</span>
                    <input
                      type="number"
                      name="correct_answer"
                      value={formState.correct_answer}
                      onChange={handleFormChange}
                      placeholder="Если требуется строгий ответ"
                    />
                  </label>
                  <label className="form-field">
                    <span>Допуск, ±</span>
                    <input
                      type="number"
                      step="0.1"
                      name="tolerance"
                      value={formState.tolerance}
                      onChange={handleFormChange}
                    />
                  </label>
                </div>
              )}

              {formState.answer_type === 'single_choice' && (
                <>
                  <label className="form-field">
                    <span>Варианты ответов</span>
                    <textarea
                      name="answer_options"
                      value={formState.answer_options}
                      onChange={handleFormChange}
                      rows={3}
                      placeholder="Каждый вариант с новой строки"
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span>Правильный вариант (опционально)</span>
                    <input
                      type="text"
                      name="correct_answer"
                      value={formState.correct_answer}
                      onChange={handleFormChange}
                    />
                  </label>
                </>
              )}

              {formState.answer_type === 'boolean' && (
                <label className="form-field">
                  <span>Ожидаемый ответ (опционально)</span>
                  <select name="correct_answer" value={formState.correct_answer} onChange={handleFormChange}>
                    <option value="">Нет</option>
                    <option value="true">Да</option>
                    <option value="false">Нет</option>
                  </select>
                </label>
              )}

              <label className="form-field">
                <span>Доступные отделы</span>
                <select
                  name="departments"
                  multiple
                  value={formState.departments}
                  onChange={handleFormChange}
                  className="multi-select"
                >
                  {departmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small className="field-hint">Если ничего не выбрать, вопрос доступен всем отделам.</small>
              </label>

              <label className="form-checkbox">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formState.is_active}
                  onChange={handleFormChange}
                />
                <span>Вопрос активен и доступен в тестах</span>
              </label>

              <footer className="modal-actions">
                <button type="button" className="btn ghost" onClick={closeModal} disabled={formSubmitting}>
                  Отмена
                </button>
                <button type="submit" className="btn primary" disabled={formSubmitting}>
                  <FiDatabase size={16} /> {formSubmitting ? 'Сохраняем…' : 'Сохранить'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSkillQuestions;
