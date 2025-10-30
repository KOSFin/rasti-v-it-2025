import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNineBoxMatrix } from '../api/services';
import './NineBox.css';

function NineBox() {
  const navigate = useNavigate();
  const [matrixData, setMatrixData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatrixData();
  }, []);

  const fetchMatrixData = async () => {
    try {
      const response = await getNineBoxMatrix();
      setMatrixData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching matrix data:', error);
      setLoading(false);
    }
  };

  const getBoxLabel = (x, y) => {
    const labels = [
      ['Низкая результативность\nНизкий потенциал', 'Средняя результативность\nНизкий потенциал', 'Высокая результативность\nНизкий потенциал'],
      ['Низкая результативность\nСредний потенциал', 'Средняя результативность\nСредний потенциал', 'Высокая результативность\nСредний потенциал'],
      ['Низкая результативность\nВысокий потенциал', 'Средняя результативность\nВысокий потенциал', 'Высокая результативность\nВысокий потенциал'],
    ];
    return labels[y][x];
  };

  const getBoxColor = (x, y) => {
    if (x === 2 && y === 2) return '#4caf50'; // Звезды
    if ((x === 2 && y === 1) || (x === 1 && y === 2)) return '#8bc34a'; // Высокий потенциал
    if (x === 1 && y === 1) return '#ffeb3b'; // Средний уровень
    if (x === 0 || y === 0) return '#ff9800'; // Требуют внимания
    return '#f44336'; // Риск
  };

  const getEmployeesInBox = (x, y) => {
    return matrixData.filter(emp => emp.nine_box_x === x && emp.nine_box_y === y);
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
        <h1>9-Box матрица талантов</h1>
      </div>

      <div className="matrix-container">
        <div className="matrix-labels">
          <div className="y-axis-label">Потенциал →</div>
        </div>
        
        <div className="nine-box-grid">
          {[2, 1, 0].map(y => (
            [0, 1, 2].map(x => {
              const employees = getEmployeesInBox(x, y);
              return (
                <div
                  key={`${x}-${y}`}
                  className="matrix-box"
                  style={{ backgroundColor: getBoxColor(x, y) }}
                >
                  <div className="box-label">{getBoxLabel(x, y)}</div>
                  <div className="box-employees">
                    {employees.length > 0 ? (
                      <ul>
                        {employees.map(emp => (
                          <li key={emp.employee_id}>
                            <strong>{emp.employee_name}</strong>
                            <br />
                            <small>{emp.position}</small>
                            <br />
                            <small>П: {emp.performance_score} | Р: {emp.potential_score}</small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="no-employees">Нет сотрудников</p>
                    )}
                  </div>
                </div>
              );
            })
          ))}
        </div>
        
        <div className="x-axis-label">← Результативность</div>
      </div>

      <div className="matrix-legend">
        <h3>Легенда</h3>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-color" style={{backgroundColor: '#4caf50'}}></div>
            <span>Звезды - высокая результативность и потенциал</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{backgroundColor: '#8bc34a'}}></div>
            <span>Высокий потенциал - готовы к развитию</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{backgroundColor: '#ffeb3b'}}></div>
            <span>Средний уровень - стабильная работа</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{backgroundColor: '#ff9800'}}></div>
            <span>Требуют внимания - нужна поддержка</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{backgroundColor: '#f44336'}}></div>
            <span>Риск - требуется план действий</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NineBox;
