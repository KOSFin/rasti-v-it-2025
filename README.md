<div align="center">

![Python](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)
![Django](https://img.shields.io/badge/Django-5.2-green?style=for-the-badge&logo=django)
![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=for-the-badge&logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-latest-2496ED?style=for-the-badge&logo=docker)

# Performance Management System

**Система объективной оценки и адаптации персонала**

</div>
<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/99589fe2-8eee-464c-a1de-55b3945e00ab" />


---

## Демо и ссылки

| Ресурс | URL |
|--------|-----|
| **Фронтенд приложения (ДЕМО) (для работы может понадобится VPN - размещено на CloudFlare)** | [https://hak-rosti-v-it.ruka.me](https://hak-rosti-v-it.ruka.me) |
| **Backend API** | [https://api-hak-rosti-v-it.ruka.me](https://api-hak-rosti-v-it.ruka.me) |
| **Swagger документация** | [https://api-hak-rosti-v-it.ruka.me/api/docs/](https://api-hak-rosti-v-it.ruka.me/api/docs/) |
| **ReDoc документация** | [https://api-hak-rosti-v-it.ruka.me/api/redoc/](https://api-hak-rosti-v-it.ruka.me/api/redoc/) |
| **Админ-панель Django** | [https://api-hak-rosti-v-it.ruka.me/admin/](https://api-hak-rosti-v-it.ruka.me/admin/) |

---

## О проекте

Performance Management System — это комплексная система для управления эффективностью персонала, разработанная для решения ключевых проблем HR-менеджмента в современных компаниях.

### Проблематика

Современные компании сталкиваются с рядом критических проблем в управлении персоналом:

- **Долгая адаптация новичков** — сотрудники долго выходят на полную продуктивность (Time-to-Productivity)
- **Отсутствие связи целей с компетенциями** — нет четкой взаимосвязи между задачами и необходимыми навыками
- **Отсутствие индивидуальных планов развития (ИПР)** — нет системного подхода к развитию сотрудников
- **Командные конфликты и низкая коллаборация** — недостаточная оценка soft skills приводит к проблемам во взаимодействии
- **Ручная обработка отзывов** — огромные затраты времени HR и менеджеров на анализ текстовых отзывов
- **Утечка талантов (HiPo)** — нет инструментов для выявления и удержания высокопотенциальных сотрудников
- **Субъективность кадровых решений** — отсутствие объективных данных для принятия решений о повышении, ротации или увольнении

### Наше решение

Performance Management System предлагает комплексный подход к оценке и развитию персонала:

#### Ключевые возможности

**1. Адаптация сотрудников**
- План адаптации с четкими ключевыми задачами
- Оценка каждой задачи (TaskScore)
- Быстрый фидбек от коллег и руководителя
- **Результат:** Сокращение Time-to-Productivity на 20-30%

**2. Система оценки навыков (Hard & Soft Skills)**
- Регулярные циклы оценки (1/3/6/12 месяцев)
- Оценка профессиональных (Hard) и личных (Soft) навыков
- Peer-review от коллег
- Самооценка и оценка руководителя
- **Результат:** Повышение качества выполнения задач на 15-20%

**3. Связь целей и задач с компетенциями**
- Создание целей (стратегических, тактических, личного развития)
- Разбивка на конкретные задачи
- Оценка результатов по завершению
- Видимость прогресса в реальном времени
- **Результат:** Повышение эффективности на 25-30%

**4. Автоматическая генерация ИПР**
- Выявление разрывов между самооценкой и оценкой коллег/менеджера
- Интеграция с ИИ для генерации плана развития
- Фокус на зоны роста каждого сотрудника
- **Результат:** Повышение вовлеченности на 15-20%

**5. 9-Box матрица (Потенциал / Результативность)**
- Автоматическая группировка сотрудников
- Выявление HiPo (высокопотенциальных сотрудников)
- Определение рисков ухода
- Рекомендации по salary increase
- **Результат:** Снижение текучки HiPo на 20-30%

**6. Аналитика и отчетность**
- Дашборд с динамикой оценок
- Визуализация прогресса по целям и задачам
- Сравнение по департаментам
- Стандартизированные числовые показатели
- **Результат:** Сокращение времени на аналитику на 40-50%

**7. Роль HR Бизнес-партнера**
- Контроль эффективности команд
- Доступ к аналитике по всем отделам
- Инструменты для принятия кадровых решений

### Бизнес-эффект

| Показатель | Улучшение |
|------------|-----------|
| Сокращение Time-to-Productivity | 20-30% |
| Повышение качества выполнения задач | 15-20% |
| Повышение общей эффективности | 25-30% |
| Сокращение командных инцидентов | 15-20% |
| Повышение CSAT (удовлетворенность) | 15-20% |
| Повышение eNPS (лояльность) | 15-20% |
| Сокращение времени на аналитику (HR) | 40-50% |
| Ускорение кадровых решений | 40-50% |
| Снижение текучки HiPo | 20-30% |

---

## Архитектура проекта

Проект построен по микросервисной архитектуре с разделением на Frontend и Backend:

```
rasti-v-it/
│
├── Frontend/                # React приложение (UI)
│   ├── src/
│   │   ├── api/            # Axios клиент для API
│   │   ├── components/     # React компоненты
│   │   │   ├── layout/    # Компоненты макета (Header, Sidebar)
│   │   │   └── reviews/   # Компоненты оценок
│   │   ├── contexts/      # React Context (Auth, Theme, Notifications)
│   │   └── assets/        # Статические файлы
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── Backend/                # Django REST API
│   ├── api/               # Основное API приложение
│   │   ├── models.py     # Модели данных (Employee, Goal, Task, etc.)
│   │   ├── views.py      # ViewSets для API
│   │   ├── serializers.py # DRF сериализаторы
│   │   ├── urls.py       # URL маршруты
│   │   └── auth_views.py # Аутентификация
│   │
│   ├── performance/       # Модуль оценки эффективности
│   │   ├── models.py     # Модели (ReviewLog, SkillAnswer, etc.)
│   │   ├── views.py      # API views для оценок
│   │   ├── services.py   # Бизнес-логика
│   │   ├── serializers.py
│   │   └── migrations/
│   │
│   ├── Backend/           # Настройки Django
│   │   ├── settings.py   # Конфигурация
│   │   ├── urls.py       # Главные URL
│   │   └── wsgi.py
│   │
│   ├── Dockerfile
│   ├── requirements.txt
│   └── manage.py
│
├── docker-compose.yml     # Оркестрация контейнеров
├── nginx.conf            # Reverse proxy конфигурация
└── README.md
```

---

## Технологический стек

### Backend

| Технология | Версия | Назначение |
|------------|--------|------------|
| **Python** | 3.11+ | Основной язык программирования |
| **Django** | 5.2 | Web-фреймворк |
| **Django REST Framework** | 3.15.2 | REST API фреймворк |
| **PostgreSQL** | 16 | Реляционная база данных |
| **JWT (Simple JWT)** | 5.5.1 | Аутентификация и авторизация |
| **drf-spectacular** | 0.27.0 | Автогенерация OpenAPI/Swagger документации |
| **django-cors-headers** | 4.6.0 | CORS middleware |
| **django-filter** | 24.3 | Фильтрация данных в API |
| **Gunicorn** | 23.0.0 | WSGI HTTP сервер |
| **psycopg2-binary** | 2.9.10 | PostgreSQL адаптер |

### Frontend

| Технология | Версия | Назначение |
|------------|--------|------------|
| **React** | 18.2.0 | UI библиотека |
| **React Router** | 6.20.0 | Маршрутизация |
| **Axios** | 1.6.2 | HTTP клиент |
| **Recharts** | 2.10.3 | Графики и визуализация данных |
| **React Icons** | 5.0.1 | Иконки |
| **Vite** | 5.0.8 | Build tool и dev server |

### DevOps & Infrastructure

| Технология | Назначение |
|------------|------------|
| **Docker** | Контейнеризация приложений |
| **Docker Compose** | Оркестрация multi-container приложения |
| **Nginx** | Reverse proxy и статический сервер |
| **Traefik** | Load balancer (на продакшене) |

---

## База данных

Система использует PostgreSQL с следующей структурой:

### Основные таблицы

**Управление пользователями и структурой**
- `auth_user` — Пользователи Django
- `api_employee` — Профили сотрудников
- `api_department` — Отделы компании
- `api_departmentposition` — Должности в отделах

**Цели и задачи**
- `api_goal` — Цели (стратегические, тактические, личное развитие)
- `api_task` — Задачи, связанные с целями
- `api_goalparticipant` — Участники групповых целей

**Оценка навыков**
- `performance_employer` — Профили для оценки (синхронизированы с Employee)
- `performance_reviewperiod` — Периоды оценки (Start, 1M, 3M, 6M, 12M)
- `performance_skillquestion` — Вопросы для оценки навыков
- `performance_reviewlog` — Логи сессий оценки
- `performance_skillanswer` — Ответы на вопросы по навыкам

**Оценка целей и задач**
- `performance_reviewgoal` — Привязка целей к периодам оценки
- `performance_reviewtask` — Привязка задач к периодам оценки
- `performance_taskanswer` — Ответы на оценку задач

**Оценки сотрудников (360°)**
- `api_selfassessment` — Самооценка
- `api_feedback360` — Оценка от коллег (360°)
- `api_managerreview` — Оценка от руководителя
- `api_potentialassessment` — Оценка потенциала
- `api_finalreview` — Итоговая оценка

**Уведомления**
- `api_goalevaluationnotification` — Уведомления об оценке целей
- `performance_sitenotification` — Системные уведомления

### Ключевые связи

```
User (Django Auth)
    └── Employee
        ├── Department
        │   └── DepartmentPosition
        ├── Goals (creator & participant)
        │   └── Tasks
        └── Employer (performance)
            ├── ReviewPeriods
            ├── SkillAnswers
            └── TaskAnswers
```

---

## Система ролей

Система поддерживает 4 роли с разными уровнями доступа:

| Роль | Код | Права доступа |
|------|-----|---------------|
| **Суперпользователь (Admin)** | `admin` | Полный доступ ко всем данным и настройкам. Может создавать отделы, должности, пользователей. Доступ к админ-панели Django. |
| **Бизнес-партнер** | `business_partner` | Доступ к аналитике по всем отделам. 9-Box матрица. Отчеты по всей компании. Может просматривать данные всех сотрудников. |
| **Менеджер** | `manager` | Управление своим отделом. Создание целей для подчиненных. Оценка сотрудников своего отдела. Доступ к отчетам по своей команде. |
| **Сотрудник** | `employee` | Работа со своими целями и задачами. Прохождение оценок (самооценка, 360°). Просмотр своей аналитики. Peer-review коллег. |

---

## Расчет показателей

### Оценка навыков (Skill Score)

Для каждого навыка рассчитывается средний балл с учетом весов:

```
Skill Score = Σ(Answer × Weight) / Σ(Weight)
```

Где:
- `Answer` — ответ на вопрос (шкала 0-10)
- `Weight` — вес вопроса (по умолчанию 1.0)

### Результативность (Performance Score)

Рассчитывается на основе:
- Оценки выполнения целей (Goal Score)
- Оценки выполнения задач (Task Score)
- Самооценки
- Оценки 360° от коллег
- Оценки руководителя

```
Performance = (Goals + Tasks + SelfAssessment + Feedback360 + ManagerReview) / 5
```

### Потенциал (Potential Score)

Рассчитывается на основе:
- Профессиональных качеств (Hard Skills)
- Личных качеств (Soft Skills)
- Способности к обучению
- Лидерских качеств

```
Potential = (HardSkills + SoftSkills + Learning + Leadership) / 4
```

### 9-Box позиционирование

Сотрудники распределяются в матрицу 3×3 на основе:
- **Ось X:** Performance Score (0-10)
- **Ось Y:** Potential Score (0-10)

| Потенциал / Результативность | Низкая (0-3.33) | Средняя (3.34-6.66) | Высокая (6.67-10) |
|-------------------------------|-----------------|---------------------|-------------------|
| **Высокий** | Развивать | Ключевой игрок | **HiPo (Звезда)** |
| **Средний** | Требует внимания | Стабильный | Эксперт |
| **Низкий** | Риск увольнения | Ограниченный | Специалист |

### Индекс адаптации (Adaptation Index)

Для новых сотрудников рассчитывается индекс адаптации:

```
Adaptation Index = (CurrentScore / ExpectedScore) × 100%
```

Где:
- `CurrentScore` — текущий средний балл по всем оценкам
- `ExpectedScore` — ожидаемый балл для данного периода

---

## API Endpoints

### Аутентификация

```
POST   /api/auth/register/              Регистрация пользователя
POST   /api/auth/login/                 Вход в систему
POST   /api/auth/logout/                Выход из системы
GET    /api/auth/me/                    Текущий пользователь
POST   /api/auth/token/refresh/         Обновление JWT токена
POST   /api/auth/admin/create-employee/ Создание сотрудника (admin)
```

### Организационная структура

```
GET    /api/departments/                Список отделов
POST   /api/departments/                Создать отдел
GET    /api/departments/{id}/           Детали отдела
PATCH  /api/departments/{id}/           Обновить отдел
DELETE /api/departments/{id}/           Удалить отдел

GET    /api/employees/                  Список сотрудников
POST   /api/employees/                  Создать сотрудника
GET    /api/employees/{id}/             Детали сотрудника
PATCH  /api/employees/{id}/             Обновить сотрудника
GET    /api/employees/{id}/team/        Команда сотрудника
```

### Цели и задачи

```
GET    /api/goals/                      Список целей
POST   /api/goals/                      Создать цель
GET    /api/goals/{id}/                 Детали цели
PATCH  /api/goals/{id}/                 Обновить цель
POST   /api/goals/{id}/complete/        Завершить цель
DELETE /api/goals/{id}/                 Удалить цель

GET    /api/tasks/                      Список задач
POST   /api/tasks/                      Создать задачу
GET    /api/tasks/{id}/                 Детали задачи
PATCH  /api/tasks/{id}/                 Обновить задачу
DELETE /api/tasks/{id}/                 Удалить задачу
```

### Оценки

```
GET    /api/self-assessments/           Самооценки
POST   /api/self-assessments/           Создать самооценку
GET    /api/self-assessments/pending/   Ожидающие самооценки

GET    /api/feedback-360/               Оценки 360°
POST   /api/feedback-360/               Создать оценку 360°

GET    /api/manager-reviews/            Оценки руководителя
POST   /api/manager-reviews/            Создать оценку
```

### Performance (Оценка навыков и адаптации)

```
POST   /api/performance/review/initiate/          Инициировать цикл оценки
GET    /api/performance/review/form/              Форма оценки (по токену)
POST   /api/performance/review/submit/            Отправить ответы
GET    /api/performance/review/analytics/         Аналитика оценок
GET    /api/performance/review/overview/          Обзор оценок сотрудника
GET    /api/performance/review/manager/queue/     Очередь оценок для менеджера
POST   /api/performance/review/manager/feedback/  Фидбек от менеджера
GET    /api/performance/review/adaptation-index/  Индекс адаптации

POST   /api/performance/task-goal/create/         Создать цель/задачу с оценкой
POST   /api/performance/task-review/start/        Запустить оценку задачи
GET    /api/performance/task-review/form/         Форма оценки задачи
POST   /api/performance/task-review/submit/       Отправить оценку задачи

GET    /api/performance/notifications/            Уведомления
POST   /api/performance/notifications/{id}/read/  Прочитать уведомление
POST   /api/performance/notifications/mark-all/   Отметить все прочитанными
```

### 9-Box и аналитика

```
GET    /api/potential-assessments/      Оценки потенциала
POST   /api/potential-assessments/      Создать оценку потенциала

GET    /api/final-reviews/              Итоговые оценки
GET    /api/final-reviews/nine-box/     Данные для 9-Box матрицы
```

---

## Периоды оценки

Система автоматически создает периоды оценки для каждого сотрудника:

| Период | Код | Когда проводится | Цель |
|--------|-----|------------------|------|
| **Старт** | `Start` | При приеме на работу | Начальная оценка компетенций |
| **1 месяц** | `1M` | Через 1 месяц после приема | Оценка первичной адаптации |
| **3 месяца** | `3M` | Через 3 месяцев после приема | Промежуточная оценка адаптации |
| **6 месяцев** | `6M` | Через 6 месяцев после приема | Завершение испытательного срока |
| **12 месяцев** | `12M` | Через 12 месяцев после приема | Годовая оценка эффективности |

После первого года оценки проводятся ежегодно или по запросу менеджера.

---

## Установка и запуск

### Предварительные требования

- Docker 20.10+
- Docker Compose 2.0+
- Git

### Локальный запуск

1. Клонируйте репозиторий:

```bash
git clone https://github.com/KOSFin/rasti-v-it-2025.git
cd rasti-v-it-2025
```

2. Создайте файл `.env` в корне проекта:

```env
DEBUG=True
SECRET_KEY=your-secret-key-here
DB_NAME=rasti_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=db
DB_PORT=5432
ALLOWED_HOSTS=localhost,127.0.0.1
```

3. Запустите контейнеры:

```bash
docker-compose up -d
```

4. Выполните миграции:

```bash
docker-compose exec backend python manage.py migrate
```

5. Создайте суперпользователя:

```bash
docker-compose exec backend python manage.py createsuperuser
```

6. Загрузите начальные данные (опционально):

```bash
docker-compose exec backend python manage.py seed_skill_questions
```

7. Приложение доступно по адресам:
   - Frontend: http://localhost:80
   - Backend API: http://localhost:8000
   - Swagger: http://localhost:8000/api/docs/
   - Admin: http://localhost:8000/admin/

---

## Графики и визуализация

Система предоставляет богатую визуализацию данных с помощью библиотеки Recharts:

### Dashboard (Дашборд)

- **Radar Chart** — Оценка навыков по категориям (Hard Skills, Soft Skills, Leadership)
- **Line Chart** — Динамика оценок по периодам (Start → 1M → 3M → 6M → 12M)
- **Bar Chart** — Сравнение самооценки и оценки коллег
- **Progress Bars** — Прогресс по целям и задачам

### 9-Box Matrix

- **Scatter Plot** — Позиционирование сотрудников по осям Potential / Performance
- Интерактивные точки с подробной информацией при наведении
- Цветовое кодирование по зонам (HiPo, Риск, Стабильный)

### Reports (Отчеты)

- **Pie Chart** — Распределение сотрудников по категориям
- **Area Chart** — Динамика показателей команды
- **Heatmap** — Корреляция навыков и результативности

---

## Особенности реализации

### Безопасность

- **JWT аутентификация** с автоматическим обновлением токенов
- **CORS настройка** с whitelist разрешенных доменов
- **CSRF защита** для дополнительной безопасности
- **Role-based access control (RBAC)** — доступ на основе ролей
- **Token blacklist** при выходе из системы

### Производительность

- **Select related / Prefetch related** — оптимизация запросов к БД
- **Pagination** — все списки с пагинацией (page_size=10)
- **Фильтрация на уровне БД** — django-filter для эффективных запросов
- **Indexing** — индексы на часто запрашиваемых полях

### UX/UI

- **Dark/Light режимы** — поддержка темной и светлой темы
- **Responsive design** — адаптивный дизайн для всех устройств
- **Real-time notifications** — уведомления в реальном времени
- **Loading states** — индикаторы загрузки для всех асинхронных операций
- **Error handling** — понятные сообщения об ошибках

---

## Roadmap (Будущие возможности)

- [ ] **Интеграция с ERP-системами** — синхронизация БД сотрудников, выгрузка результатов оценки
- [ ] **ИИ-ассистент для ИПР** — автоматическая генерация индивидуальных планов развития на основе оценок
- [ ] **Мобильное приложение** — нативные приложения для iOS и Android
- [ ] **Gamification** — система достижений и бейджей для повышения вовлеченности
- [ ] **Multi-tenant** — поддержка нескольких компаний в одной инсталляции
- [ ] **Advanced analytics** — ML-модели для прогнозирования рисков увольнения
- [ ] **Экспорт отчетов** — экспорт в PDF, Excel, PowerPoint
- [ ] **Интеграция с календарями** — напоминания о сроках оценок
- [ ] **Видео-отзывы** — возможность записи видео-фидбека от менеджеров

---

## Авторы

**Проект разработан в рамках олимпиады «Расти в IT»**

- **Кейс:** Wink (Ростелеком)
- **Команда:** №13
- **Год:** 2025

Система создана для решения реальных задач HR-менеджмента и оценки персонала в крупных технологических компаниях.

---

## Лицензия

Все права защищены. Проект разработан в образовательных целях в рамках олимпиады.

---

<div align="center">

**Сделано с ❤️ командой №13 для олимпиады «Расти в IT» 2025**

</div>
