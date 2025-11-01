# Инструкции по применению миграций

## Запуск миграций на сервере

Выполните следующие команды на сервере:

```bash
# Перейти в корневую директорию проекта
cd /path/to/rasti-v-it

# Создать миграции
docker-compose run --rm backend python manage.py makemigrations

# Применить миграции
docker-compose run --rm backend python manage.py migrate

# Перезапустить сервисы
docker-compose restart backend
```

## Что было изменено

### Backend Models:

1. **Goal** - добавлены поля:
   - `created_by` - кто создал цель
   - `creator_type` - тип создателя (self/manager)
   - `requires_evaluation` - обязательная ли оценка
   - `is_completed` - завершена ли цель
   - `completed_at` - дата завершения
   - `evaluation_launched` - запущена ли оценка
   - `updated_at` - дата обновления

2. **Task** - добавлены поля:
   - `completed_at` - дата завершения
   - `order` - порядок сортировки
   - `created_at` - дата создания

3. **SelfAssessment, Feedback360, ManagerReview** - изменено:
   - Поле `task` заменено на `goal` (ForeignKey на Goal вместо Task)
   - Добавлены unique_together constraints

4. **GoalEvaluationNotification** - новая модель для уведомлений об оценке целей

### Frontend:

1. Создан новый компонент `GoalsAndTasks.jsx` (объединяет Goals и Tasks)
2. Обновлен `Feedback360.jsx` для работы с целями
3. Обновлен `NotificationContext.jsx` для уведомлений об оценках
4. Обновлен `NotificationBell.jsx` для отображения количества уведомлений
5. Обновлен `App.jsx` для использования нового компонента
6. Обновлен `Sidebar.jsx` - убрана отдельная вкладка "Задачи"

## Проверка после миграции

После применения миграций проверьте:

1. API endpoint `/api/goals/` - должен возвращать цели с новыми полями
2. API endpoint `/api/goal-notifications/` - должен работать
3. Frontend страница `/goals` - должна отображать объединенный интерфейс целей и задач
4. Функция завершения цели и запуска оценки
5. Уведомления об оценках в NotificationBell
