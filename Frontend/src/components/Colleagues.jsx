import { useEffect, useMemo, useState } from 'react';
import { FiMail, FiSearch, FiUsers, FiMapPin } from 'react-icons/fi';
import { getColleagues, getEmployee } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import './Common.css';
import './Colleagues.css';

const extractResults = (response) => {
  if (!response?.data) {
    return [];
  }
  if (Array.isArray(response.data?.results)) {
    return response.data.results;
  }
  return Array.isArray(response.data) ? response.data : response.data?.results || [];
};

function Colleagues() {
  const { employee } = useAuth();
  const [profile, setProfile] = useState(null);
  const [colleagues, setColleagues] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadColleagues = async () => {
      if (!employee?.id) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [profileResponse, colleaguesResponse] = await Promise.all([
          getEmployee(employee.id),
          getColleagues(),
        ]);

        setProfile(profileResponse.data || null);
        setColleagues(extractResults(colleaguesResponse));
      } catch (err) {
        console.error('Не удалось загрузить коллег', err);
        setError('Не удалось загрузить данные. Попробуйте обновить страницу.');
        setColleagues([]);
      } finally {
        setLoading(false);
      }
    };

    loadColleagues();
  }, [employee?.id]);

  const filteredColleagues = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return colleagues;
    }

    return colleagues.filter((item) => {
      const name = (item.full_name || item.username || '').toLowerCase();
      const position = (item.position_name || item.position_title || '').toLowerCase();
      const department = (item.department_name || '').toLowerCase();
      return [name, position, department].some((value) => value.includes(query));
    });
  }, [colleagues, search]);

  const departmentName = profile?.department?.name || profile?.department_name || '—';
  const positionTitle =
    profile?.position?.title || profile?.position_title || profile?.position_name || '—';
  const email = profile?.user?.email || '';
  const fullName =
    [profile?.user?.last_name, profile?.user?.first_name]
      .filter(Boolean)
      .join(' ') ||
    profile?.full_name ||
    profile?.username ||
    'Мой профиль';

  return (
    <div className="page colleagues-page">
      <header className="page-header">
        <div>
          <p className="page-overline">
            <FiUsers size={14} /> Моя команда
          </p>
          <h1>Коллеги отдела</h1>
          <p className="page-subtitle">
            На этой странице собраны контакты вашей команды и краткая информация о каждом
            сотруднике.
          </p>
        </div>
        <div className="page-actions">
          <div className="input-with-icon">
            <FiSearch size={16} />
            <input
              type="search"
              placeholder="Поиск по имени или должности"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      <section className="panel profile-card">
        <header className="panel-header">
          <div>
            <p className="panel-overline">Мой профиль</p>
            <h2>{fullName}</h2>
            <span>Ваша роль в компании и отдел</span>
          </div>
        </header>
        <div className="profile-grid">
          <div className="profile-item">
            <span className="label">Отдел</span>
            <p className="value">
              <FiMapPin size={14} /> {departmentName}
            </p>
          </div>
          <div className="profile-item">
            <span className="label">Должность</span>
            <p className="value">{positionTitle}</p>
          </div>
          {email && (
            <div className="profile-item">
              <span className="label">Почта</span>
              <p className="value">
                <FiMail size={14} />
                <a href={`mailto:${email}`}>{email}</a>
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div>
            <p className="panel-overline">Коллеги вашего отдела</p>
            <h2>
              {loading
                ? 'Загружаем…'
                : filteredColleagues.length === 0
                ? 'Нет коллег'
                : `${filteredColleagues.length} человек`}
            </h2>
          </div>
        </header>

        {loading ? (
          <div className="panel placeholder">Загружаем коллег…</div>
        ) : filteredColleagues.length === 0 ? (
          <div className="panel empty">
            <p>Коллег по заданным условиям поиска не найдено.</p>
          </div>
        ) : (
          <div className="colleagues-grid">
            {filteredColleagues.map((item) => (
              <article key={item.id} className="colleague-card">
                <header className="colleague-header">
                  <div>
                    <strong>{item.full_name || item.username}</strong>
                    <span>{item.position_name || item.position_title || '—'}</span>
                  </div>
                  {item.is_manager && <span className="badge manager">Руководитель</span>}
                </header>
                <ul className="colleague-meta">
                  {item.department_name && (
                    <li>
                      <FiMapPin size={14} /> {item.department_name}
                    </li>
                  )}
                  {item.email && (
                    <li>
                      <FiMail size={14} />
                      <a href={`mailto:${item.email}`}>{item.email}</a>
                    </li>
                  )}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Colleagues;
