# API Документация - РАСТИ В ИТ

## Базовый URL
```
http://localhost:8000/api
```

## Аутентификация

API использует JWT (JSON Web Tokens) для аутентификации.

### Регистрация
```http
POST /api/auth/register/
Content-Type: application/json

{
  "username": "string",
  "password": "string",
  "email": "string",
  "first_name": "string",
  "last_name": "string",
  "department": 1,
  "position": "string",
  "is_manager": false,
  "hire_date": "2024-01-01"
}

Response: 201 Created
{
  "access": "jwt_access_token",
  "refresh": "jwt_refresh_token",
  "user": { ... }
}
```

### Вход
```http
POST /api/auth/login/
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}

Response: 200 OK
{
  "access": "jwt_access_token",
  "refresh": "jwt_refresh_token",
  "user": { ... },
  "employee": { ... }
}
```

### Обновление токена
```http
POST /api/auth/token/refresh/
Content-Type: application/json

{
  "refresh": "jwt_refresh_token"
}

Response: 200 OK
{
  "access": "new_jwt_access_token"
}
```

### Получение текущего пользователя
```http
GET /api/auth/me/
Authorization: Bearer {access_token}

Response: 200 OK
{
  "user": { ... },
  "employee": { ... }
}
```

## Отделы (Departments)

### Список отделов
```http
GET /api/departments/
Authorization: Bearer {access_token}

Response: 200 OK
[
  {
    "id": 1,
    "name": "IT Department",
    "description": "..."
  }
]
```

## Сотрудники (Employees)

### Список сотрудников
```http
GET /api/employees/?department=1&is_manager=true
Authorization: Bearer {access_token}

Response: 200 OK
{
  "count": 10,
  "next": "...",
  "previous": null,
  "results": [...]
}
```

### Получение сотрудника
```http
GET /api/employees/{id}/
Authorization: Bearer {access_token}
```

### Список менеджеров
```http
GET /api/employees/managers/
Authorization: Bearer {access_token}
```

### Команда сотрудника
```http
GET /api/employees/{id}/team/
Authorization: Bearer {access_token}
```

## Цели (Goals)

### Список целей
```http
GET /api/goals/?goal_type=tactical&ordering=-created_at
Authorization: Bearer {access_token}
```

### Создание цели
```http
POST /api/goals/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "title": "string",
  "description": "string",
  "goal_type": "strategic|tactical|personal",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "expected_results": "string",
  "task_link": "https://..."
}

Response: 201 Created
```

### Обновление цели
```http
PUT /api/goals/{id}/
Authorization: Bearer {access_token}
```

### Удаление цели
```http
DELETE /api/goals/{id}/
Authorization: Bearer {access_token}

Response: 204 No Content
```

## Задачи (Tasks)

### Список задач
```http
GET /api/tasks/?goal=1&is_completed=false
Authorization: Bearer {access_token}
```

### Создание задачи
```http
POST /api/tasks/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "goal": 1,
  "title": "string",
  "description": "string",
  "is_completed": false
}
```

### Обновление задачи
```http
PUT /api/tasks/{id}/
PATCH /api/tasks/{id}/
Authorization: Bearer {access_token}
```

## Самооценка (Self Assessments)

### Список самооценок
```http
GET /api/self-assessments/
Authorization: Bearer {access_token}
```

### Создание самооценки
```http
POST /api/self-assessments/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "task": 1,
  "achieved_results": "string",
  "personal_contribution": "string",
  "skills_acquired": "string",
  "improvements_needed": "string",
  "collaboration_quality": 8,  // 0-10
  "satisfaction_score": 7       // 0-10
}

Response: 201 Created
{
  ...
  "calculated_score": 4  // автоматически рассчитанный балл
}
```

## Оценка 360 (Feedback 360)

### Список оценок, данных мной
```http
GET /api/feedback-360/
Authorization: Bearer {access_token}
```

### Оценки обо мне
```http
GET /api/feedback-360/for_me/
Authorization: Bearer {access_token}
```

### Список коллег для оценки
```http
GET /api/feedback-360/pending/
Authorization: Bearer {access_token}
```

### Создание оценки
```http
POST /api/feedback-360/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "employee": 2,
  "task": 1,
  "results_achievement": 8,      // 0-10
  "personal_qualities": "string",
  "collaboration_quality": 9,     // 0-10
  "improvements_suggested": "string"
}

Response: 201 Created
{
  ...
  "calculated_score": 5  // автоматически
}
```

## Оценка менеджера (Manager Reviews)

### Моя команда (для менеджеров)
```http
GET /api/manager-reviews/my_team/
Authorization: Bearer {access_token}
```

### Создание оценки сотрудника
```http
POST /api/manager-reviews/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "employee": 2,
  "task": 1,
  "results_achievement": 8,           // 0-10
  "personal_qualities_feedback": "string",
  "personal_contribution_feedback": "string",
  "collaboration_quality": 9,         // 0-10
  "improvements_recommended": "string",
  "overall_rating": 9,                // 0-10
  "feedback_summary": "string"
}

Response: 201 Created
{
  ...
  "calculated_score": 7  // автоматически
}
```

## Оценка потенциала (Potential Assessments)

### 9-Box матрица
```http
GET /api/potential-assessments/nine_box_matrix/
Authorization: Bearer {access_token}

Response: 200 OK
[
  {
    "employee_id": 2,
    "employee_name": "John Doe",
    "position": "Developer",
    "performance_score": 8,
    "potential_score": 15,
    "nine_box_x": 2,  // 0-2 (результативность)
    "nine_box_y": 2   // 0-2 (потенциал)
  }
]
```

### Создание оценки потенциала
```http
POST /api/potential-assessments/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "employee": 2,
  "professional_qualities": ["качество1", "качество2"],
  "personal_qualities": ["качество1", "качество2"],
  "needed_motivation": false,
  "communication_issues": false,
  "development_desire": "proactive|needs_help|unsure|no_desire",
  "is_successor": true,
  "successor_readiness": "1-2|3|3+",
  "retention_risk": 2  // 0-10
}

Response: 201 Created
{
  ...
  "performance_score": 8,
  "potential_score": 15,
  "nine_box_x": 2,
  "nine_box_y": 2
}
```

## Итоговые отчеты (Final Reviews)

### Список отчетов
```http
GET /api/final-reviews/
Authorization: Bearer {access_token}
```

### Создание отчета
```http
POST /api/final-reviews/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "employee": 2,
  "review_period": "1 полугодие 2024",
  "development_plan": "string",
  "manager_summary": "string"
}
```

### Расчет итогового балла
```http
POST /api/final-reviews/{id}/calculate_final_score/
Authorization: Bearer {access_token}

Response: 200 OK
{
  ...
  "self_assessment_score": 3.5,
  "feedback_360_score": 4.2,
  "manager_review_score": 6.8,
  "potential_score": 12.5,
  "total_score": 27.0,
  "salary_recommendation": "include|conditional|exclude"
}
```

### Статистика (для менеджеров)
```http
GET /api/final-reviews/statistics/
Authorization: Bearer {access_token}

Response: 200 OK
{
  "total_reviews": 25,
  "average_score": 24.5,
  "salary_recommendations": {
    "include": 10,
    "conditional": 8,
    "exclude": 7
  }
}
```

## Фильтрация и сортировка

Все list endpoints поддерживают:

### Фильтрация
```http
GET /api/goals/?goal_type=tactical&employee=1
```

### Поиск
```http
GET /api/employees/?search=john
```

### Сортировка
```http
GET /api/goals/?ordering=-created_at
GET /api/goals/?ordering=start_date
```

### Пагинация
```http
GET /api/goals/?page=2&page_size=20
```

## Коды ответов

- `200 OK` - Успешный запрос
- `201 Created` - Ресурс создан
- `204 No Content` - Успешное удаление
- `400 Bad Request` - Некорректные данные
- `401 Unauthorized` - Требуется аутентификация
- `403 Forbidden` - Недостаточно прав
- `404 Not Found` - Ресурс не найден
- `500 Internal Server Error` - Ошибка сервера

## Формат ошибок

```json
{
  "error": "Описание ошибки",
  "detail": "Дополнительная информация"
}
```

## Примеры использования

### cURL

```bash
# Вход
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Получение целей
curl -X GET http://localhost:8000/api/goals/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Создание задачи
curl -X POST http://localhost:8000/api/tasks/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": 1,
    "title": "Новая задача",
    "description": "Описание задачи",
    "is_completed": false
  }'
```

### JavaScript (Axios)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Вход
const login = async (username, password) => {
  const response = await api.post('/auth/login/', { username, password });
  localStorage.setItem('token', response.data.access);
  return response.data;
};

// Получение целей с токеном
const getGoals = async () => {
  const token = localStorage.getItem('token');
  const response = await api.get('/goals/', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
```

## Примечания

- Все даты в формате ISO 8601: `YYYY-MM-DD`
- Все временные метки включают timezone
- Числовые оценки от 0 до 10
- Баллы рассчитываются автоматически при создании
- Менеджеры имеют доступ к данным своего отдела
- Сотрудники видят только свои данные
