import { useEffect, useMemo, useState } from 'react';
import { FiClock, FiCpu, FiGrid, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { getNineBoxMatrix } from '../api/services';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import './NineBox.css';

const BOX_LABELS = [
  [
    'Низкая результативность\nНизкий потенциал',
    'Средняя результативность\nНизкий потенциал',
    'Высокая результативность\nНизкий потенциал',
  ],
  [
    'Низкая результативность\nСредний потенциал',
    'Средняя результативность\nСредний потенциал',
    'Высокая результативность\nСредний потенциал',
  ],
  [
    'Низкая результативность\nВысокий потенциал',
    'Средняя результативность\nВысокий потенциал',
    'Высокая результативность\nВысокий потенциал',
  ],
];

const BOX_CODES = [
  ['low-low', 'mid-low', 'high-low'],
  ['low-mid', 'mid-mid', 'high-mid'],
  ['low-high', 'mid-high', 'high-high'],
];

const buildEmptyDistribution = () => {
  const template = {};
  BOX_CODES.flat().forEach((code) => {
    template[code] = 0;
  });
  return template;
};

const computeStatsFromMatrix = (matrix) => {
  const total = matrix.length;
  const distribution = buildEmptyDistribution();
  let performanceSum = 0;
  let potentialSum = 0;

  matrix.forEach((entry) => {
    const perf = Number(entry.performance_score || 0);
    const pot = Number(entry.potential_score || 0);
    performanceSum += perf;
    potentialSum += pot;
    const x = Math.max(0, Math.min(2, entry.nine_box_x ?? 0));
    const y = Math.max(0, Math.min(2, entry.nine_box_y ?? 0));
    const code = BOX_CODES[y][x];
    distribution[code] = (distribution[code] || 0) + 1;
  });

  return {
    total_employees: total,
    average_performance: total ? performanceSum / total : 0,
    average_potential: total ? potentialSum / total : 0,
    distribution,
  };
};

const normalizePayload = (raw) => {
  if (Array.isArray(raw)) {
    const stats = computeStatsFromMatrix(raw);
    return {
      matrix: raw,
      stats,
      aiRecommendations: [],
      generatedAt: null,
      validUntil: null,
    };
  }

  const matrix = Array.isArray(raw?.matrix)
    ? raw.matrix
    : Array.isArray(raw?.payload?.matrix)
    ? raw.payload.matrix
    : Array.isArray(raw)
    ? raw
    : [];

  const stats = raw?.stats ? raw.stats : computeStatsFromMatrix(matrix);
  const recommendations = raw?.ai_recommendations || raw?.recommendations || [];

  return {
    matrix,
    stats,
    aiRecommendations: recommendations,
    generatedAt: raw?.generated_at || raw?.generatedAt || null,
    validUntil: raw?.valid_until || raw?.validUntil || null,
  };
};

function NineBox() {
  const [dataset, setDataset] = useState({
    matrix: [],
    stats: {},
    aiRecommendations: [],
    generatedAt: null,
    validUntil: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadMatrix = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getNineBoxMatrix();
      const raw = response?.data ?? [];
      const normalized = normalizePayload(raw);
      setDataset(normalized);
    } catch (err) {
      console.error('Не удалось загрузить матрицу 9-Box', err);
      setError('Не удалось загрузить матрицу. Проверьте права доступа или попробуйте позже.');
      setDataset({
        matrix: [],
        stats: {},
        aiRecommendations: [],
        generatedAt: null,
        validUntil: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatrix();
  }, []);

  const normalizedMatrix = dataset.matrix || [];

  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return normalizedMatrix;
    }
    return normalizedMatrix.filter((entry) =>
      (entry.employee_name || '').toLowerCase().includes(query)
    );
  }, [normalizedMatrix, search]);

  const grid = useMemo(() => {
    const result = Array.from({ length: 3 }, () =>
      Array.from({ length: 3 }, () => [])
    );

    filteredData.forEach((entry) => {
      const x = Math.max(0, Math.min(2, entry.nine_box_x ?? 0));
      const y = Math.max(0, Math.min(2, entry.nine_box_y ?? 0));
      result[y][x].push(entry);
    });
    return result;
  }, [filteredData]);

  const summary = useMemo(() => {
    const stars = grid[2][2]?.length || 0;
    const highPotential = (grid[2][1]?.length || 0) + (grid[1][2]?.length || 0);
    const attention = grid[0].reduce((acc, cell) => acc + cell.length, 0) +
      grid[1][0].length +
      grid[2][0].length;

    return {
      total: filteredData.length,
      stars,
      highPotential,
      attention,
    };
  }, [grid, filteredData.length]);

  const distribution = useMemo(() => {
    const base = BOX_CODES.flatMap((row, y) =>
      row.map((code, x) => ({
        code,
        count: 0,
        label: BOX_LABELS[y][x].split('\n')[0],
        short: `${['Н', 'С', 'В'][y]}-${['Н', 'С', 'В'][x]}`,
      }))
    );
    const counts = Object.fromEntries(base.map((item) => [item.code, { ...item }]));

    if (dataset.stats?.distribution) {
      Object.entries(dataset.stats.distribution).forEach(([code, value]) => {
        if (counts[code]) {
          counts[code].count = value;
        }
      });
    } else {
      filteredData.forEach((entry) => {
        const x = Math.max(0, Math.min(2, entry.nine_box_x ?? 0));
        const y = Math.max(0, Math.min(2, entry.nine_box_y ?? 0));
        const code = BOX_CODES[y][x];
        counts[code].count += 1;
      });
    }

    return base.map((item) => counts[item.code]);
  }, [filteredData, dataset.stats]);

  const averagePerformance = (dataset.stats?.average_performance ?? 0).toFixed(1);
  const averagePotential = (dataset.stats?.average_potential ?? 0).toFixed(1);
  const aiRecommendations = dataset.aiRecommendations || [];
  const generatedAtLabel = dataset.generatedAt
    ? new Date(dataset.generatedAt).toLocaleString('ru-RU')
    : null;
  const validUntilLabel = dataset.validUntil
    ? new Date(dataset.validUntil).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="page nine-box-page">
      <header className="page-header">
        <div>
          <p className="page-overline">
            <FiGrid size={14} /> Матрица талантов
          </p>
          <h1>9-Box анализ команды</h1>
          <p className="page-subtitle">
            Визуализируйте потенциал и результативность сотрудников, чтобы планировать развитие и удержание
          </p>
          {(generatedAtLabel || validUntilLabel) && (
            <p className="page-meta">
              <FiClock size={14} /> Обновлено {generatedAtLabel || 'только что'}
              {validUntilLabel ? ` • Актуально до ${validUntilLabel}` : ''}
            </p>
          )}
        </div>
        <div className="page-actions">
          <div className="input-with-icon">
            <FiSearch size={16} />
            <input
              type="search"
              placeholder="Поиск по имени"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button type="button" className="btn ghost" onClick={loadMatrix} disabled={loading}>
            <FiRefreshCw size={16} /> Обновить
          </button>
        </div>
      </header>

      {error && <div className="page-banner error">{error}</div>}

      <section className="summary-grid">
        <article className="summary-card">
          <span className="label">Всего сотрудников</span>
          <span className="value">{summary.total}</span>
        </article>
        <article className="summary-card">
          <span className="label">Звезды</span>
          <span className="value accent">{summary.stars}</span>
        </article>
        <article className="summary-card">
          <span className="label">Высокий потенциал</span>
          <span className="value">{summary.highPotential}</span>
        </article>
        <article className="summary-card">
          <span className="label">Зона внимания</span>
          <span className="value warning">{summary.attention}</span>
        </article>
        <article className="summary-card">
          <span className="label">Средняя результативность</span>
          <span className="value">{averagePerformance}</span>
        </article>
        <article className="summary-card">
          <span className="label">Средний потенциал</span>
          <span className="value">{averagePotential}</span>
        </article>
      </section>

      {!loading && !error && normalizedMatrix.length === 0 && (
        <div className="page-banner info">
          <span>
            Пока нет оценок потенциала. Создайте оценку в разделе «Отчеты» или импортируйте результаты, чтобы заполнить
            матрицу талантов.
          </span>
        </div>
      )}

      <section className="panel matrix-panel">
        <header className="panel-header">
          <div>
            <p className="panel-overline">Модель 3x3</p>
            <h2>Распределение сотрудников</h2>
          </div>
        </header>

        {loading ? (
          <div className="matrix-loading">Загружаем данные матрицы…</div>
        ) : (
          <div className="matrix-wrapper">
            <div className="axis-label y">Потенциал ↑</div>
            <div className="nine-box-grid">
              {[2, 1, 0].map((y) => (
                <div key={y} className="matrix-row">
                  {[0, 1, 2].map((x) => {
                    const items = grid[y][x] || [];
                    const label = BOX_LABELS[y][x];
                    const code = BOX_CODES[y][x];
                    return (
                      <div key={`${x}-${y}`} className={`matrix-cell ${code}`}>
                        <div className="cell-header">
                          <span className="cell-title">{label.split('\n')[0]}</span>
                          <span className="cell-subtitle">{label.split('\n')[1]}</span>
                          <span className="cell-count">{items.length}</span>
                        </div>
                        <div className="cell-body">
                          {items.length === 0 ? (
                            <p className="cell-empty">Нет сотрудников</p>
                          ) : (
                            <ul>
                              {items.map((item) => (
                                <li key={item.employee_id}>
                                  <strong>{item.employee_name}</strong>
                                  <span>{item.position || '—'}</span>
                                  <span className="metrics">
                                    П: {item.performance_score} • Пот: {item.potential_score}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="axis-label x">Результативность →</div>
          </div>
        )}
      </section>

      <section className="panel chart-panel">
        <header className="panel-header">
          <div>
            <p className="panel-overline">Агрегированная статистика</p>
            <h2>Распределение по квадрантам</h2>
          </div>
        </header>
        {loading ? (
          <div className="matrix-loading">Подготавливаем график…</div>
        ) : (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                <XAxis dataKey="short" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 107, 53, 0.06)' }}
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '12px',
                    color: 'var(--text-primary)',
                  }}
                  formatter={(value, _, { payload }) => [value, payload.label]}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="var(--color-accent)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {aiRecommendations.length > 0 && (
        <section className="panel ai-panel">
          <header className="panel-header">
            <div>
              <p className="panel-overline">Персональные подсказки</p>
              <h2>
                <FiCpu size={18} /> ИИ-рекомендации
              </h2>
            </div>
          </header>
          <div className="ai-grid">
            {aiRecommendations.slice(0, 9).map((item) => (
              <article key={`${item.employee_id}-${item.title}`} className={`ai-card priority-${item.priority || 'medium'}`}>
                <header>
                  <div>
                    <strong>{item.employee_name || 'Сотрудник без имени'}</strong>
                    {item.department && <span className="tag muted">{item.department}</span>}
                  </div>
                  <span className={`priority-badge ${item.priority || 'medium'}`}>{item.priority === 'high' ? 'Высокий приоритет' : item.priority === 'low' ? 'Низкий приоритет' : 'Средний приоритет'}</span>
                </header>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <ul>
                  {(item.actions || []).map((action) => (
                    <li key={action}>• {action}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="panel legend-panel">
        <header className="panel-header">
          <div>
            <p className="panel-overline">Интерпретация</p>
            <h2>Как читать матрицу</h2>
          </div>
        </header>
        <ul className="legend-list">
          <li className="high-high">
            <strong>Звезды</strong>
            <span>Высокий потенциал и результативность. Рассмотрите планы развития и удержания.</span>
          </li>
          <li className="mid-high">
            <strong>Готовы к росту</strong>
            <span>Нуждаются в расширенных задачах и программах развития.</span>
          </li>
          <li className="low-mid">
            <strong>Требуется поддержка</strong>
            <span>Сфокусируйтесь на коучинге и краткосрочных целях по улучшению.</span>
          </li>
          <li className="low-low">
            <strong>Зона риска</strong>
            <span>Определите причины низких показателей и сформируйте план действий.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default NineBox;
