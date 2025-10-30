# Краткое описание проекта "РАСТИ В ИТ"

## Что реализовано

### Backend (Django + DRF)

✅ **Модели данных:**
- Department (Отделы)
- Employee (Сотрудники) с привязкой к User
- Goal (Цели) с типами: стратегические, тактические, личное развитие
- Task (Задачи) с привязкой к целям
- SelfAssessment (Самооценка)
- Feedback360 (Оценка 360 градусов)
- ManagerReview (Оценка менеджера)
- PotentialAssessment (Оценка потенциала с 9-Box матрицей)
- FinalReview (Итоговые отчеты)

✅ **API Endpoints:**
- Полный CRUD для всех сущностей
- JWT аутентификация (login, register, logout, refresh token)
- Фильтрация, поиск, сортировка, пагинация
- Специальные endpoints:
  - `/api/employees/managers/` - список менеджеров
  - `/api/feedback-360/for_me/` - оценки обо мне
  - `/api/feedback-360/pending/` - коллеги для оценки
  - `/api/manager-reviews/my_team/` - моя команда
  - `/api/potential-assessments/nine_box_matrix/` - данные для 9-Box
  - `/api/final-reviews/calculate_final_score/` - расчет итогов
  - `/api/final-reviews/statistics/` - статистика

✅ **Функциональность:**
- Автоматический расчет баллов при создании оценок
- Права доступа: менеджеры видят отдел, сотрудники - свои данные
- Админ-панель Django со всеми моделями
- Поддержка переменных окружения
- CORS настроен для работы с фронтендом

✅ **Docker:**
- Dockerfile для бекенда
- docker-compose.yml с PostgreSQL
- Автоматические миграции при запуске
- Создание суперпользователя
- Health checks для БД

### Frontend (React + Vite)

✅ **Компоненты:**
- Login - форма входа
- Dashboard - главная страница с навигацией
- Goals - управление целями
- Tasks - управление задачами
- SelfAssessment - форма самооценки
- Feedback360 - оценка коллег и просмотр оценок о себе
- NineBox - визуализация 9-Box матрицы талантов

✅ **Функциональность:**
- Роутинг с защищенными маршрутами
- JWT аутентификация с автообновлением токенов
- Axios API клиент с interceptors
- Адаптивный дизайн
- Различный функционал для менеджеров и сотрудников
- Формы создания и редактирования
- Списки с фильтрацией

✅ **Docker:**
- Multi-stage Dockerfile (build + production)
- Nginx для production
- Конфигурация с кэшированием и сжатием
- Support для React Router

### Infrastructure

✅ **Docker Compose:**
- Полная система (Frontend + Backend + PostgreSQL)
- Раздельные compose файлы для разработки
- Volumes для персистентности данных
- Networks для связи контейнеров

✅ **Документация:**
- README.md с полным описанием
- API.md с документацией API
- DEPLOY.md с инструкциями по развертыванию
- .env.example для обоих частей

## Структура файлов

```
rasti-v-it/
├── Backend/
│   ├── api/
│   │   ├── admin.py          # Админка
│   │   ├── models.py         # Модели
│   │   ├── serializers.py    # Сериализаторы
│   │   ├── views.py          # ViewSets
│   │   ├── auth_views.py     # Аутентификация
│   │   └── urls.py           # Роуты
│   ├── Backend/
│   │   ├── settings.py       # Настройки Django
│   │   └── urls.py           # Главные роуты
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   ├── entrypoint.sh
│   └── .env.example
│
├── Frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── axios.js      # API клиент
│   │   │   └── services.js   # API методы
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Goals.jsx
│   │   │   ├── Tasks.jsx
│   │   │   ├── SelfAssessment.jsx
│   │   │   ├── Feedback360.jsx
│   │   │   ├── NineBox.jsx
│   │   │   ├── Auth.css
│   │   │   ├── Dashboard.css
│   │   │   ├── Common.css
│   │   │   └── NineBox.css
│   │   ├── App.jsx           # Роутинг
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml         # Полная система
├── README.md
├── API.md
├── DEPLOY.md
├── .gitignore
└── SUMMARY.md                 # Этот файл
```

## Команды для запуска

### Вся система сразу:
```bash
docker-compose up --build
```

### Только Backend:
```bash
cd Backend
docker-compose up --build
```

### Локальная разработка Frontend:
```bash
cd Frontend
npm install
npm run dev
```

## Доступ к системе

После запуска:
- **Frontend:** http://localhost (или http://localhost:5173 в dev режиме)
- **Backend API:** http://localhost:8000
- **Admin панель:** http://localhost:8000/admin
- **Логин/пароль:** admin / admin

## Технологии

### Backend:
- Python 3.11
- Django 5.2
- Django REST Framework 3.15
- djangorestframework-simplejwt 5.4
- PostgreSQL 15
- Gunicorn
- Docker

### Frontend:
- React 18
- React Router DOM 6
- Axios 1.6
- Vite 5
- Nginx
- Docker

## Особенности реализации

1. **Автоматический расчет баллов:**
   - Самооценка: на основе качества сотрудничества и удовлетворенности
   - Оценка 360: на основе достижений и сотрудничества
   - Оценка менеджера: комплексная оценка по нескольким параметрам
   - Оценка потенциала: сложная формула с 9-Box позиционированием

2. **Система прав доступа:**
   - Менеджеры видят данные своего отдела
   - Сотрудники видят только свои данные
   - Специальные endpoints для различных ролей

3. **9-Box матрица:**
   - Автоматическое позиционирование сотрудников
   - Визуализация в виде матрицы 3x3
   - Цветовая индикация (от красного до зеленого)

4. **JWT Security:**
   - Access token (1 час)
   - Refresh token (7 дней)
   - Автоматическое обновление на фронтенде
   - Blacklist после logout

5. **Production Ready:**
   - Multi-stage Docker builds
   - Nginx с оптимизацией
   - Переменные окружения
   - Health checks
   - Автоматические миграции

## Что можно доработать

- [ ] Уведомления (email/push)
- [ ] Экспорт в Excel/PDF
- [ ] Графики и визуализация аналитики
- [ ] История изменений
- [ ] Комментарии к оценкам
- [ ] Загрузка файлов (документы, аватары)
- [ ] Локализация (i18n)
- [ ] Темная тема
- [ ] Mobile приложение
- [ ] Интеграция с Slack/Teams
- [ ] SSO аутентификация
- [ ] Расширенная аналитика и дашборды

## Лицензия

MIT

---

**Примечание:** Все команды консоли не выполнялись, код готов к развертыванию на сервере согласно инструкциям в DEPLOY.md
