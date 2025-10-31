#!/bin/bash

# Ожидаем готовности БД
echo "Waiting for PostgreSQL..."
# Retry until the DB host/port is reachable. Silence nc stderr to avoid DNS error spam
until nc -z "$DB_HOST" "$DB_PORT" >/dev/null 2>&1; do
  echo "  waiting for $DB_HOST:$DB_PORT..."
  sleep 0.5
done
echo "PostgreSQL started"

# Применяем миграции
echo "Applying database migrations..."
python manage.py migrate

# Опционально очищаем базу данных для свежего старта
if [ "${RESET_DB:-0}" = "1" ]; then
    echo "RESET_DB=1 — очищаем базу данных..."
    python manage.py flush --noinput
    python manage.py migrate
fi

# Создаем суперпользователя, если не существует
echo "Creating superuser..."
python manage.py shell << END
from django.contrib.auth import get_user_model
from api.models import Employee, Department

User = get_user_model()
admin_user, created = User.objects.get_or_create(
    username='admin',
    defaults={'email': 'admin@example.com', 'is_staff': True, 'is_superuser': True}
)

admin_user.email = admin_user.email or 'admin@example.com'
if not admin_user.is_staff or not admin_user.is_superuser:
    admin_user.is_staff = True
    admin_user.is_superuser = True

admin_user.first_name = admin_user.first_name or 'Админ'
admin_user.last_name = admin_user.last_name or 'Системы'
admin_user.set_password('admin')
admin_user.save()

# Создаем отдел по умолчанию, если не существует
default_dept, _ = Department.objects.get_or_create(
    name='Администрирование',
    defaults={'description': 'Отдел администрирования системы'}
)

Employee.objects.update_or_create(
    user=admin_user,
    defaults={
        'department': default_dept,
        'position': 'Администратор',
        'is_manager': True,
        'hire_date': '2025-01-01'
    }
)

print('Суперпользователь admin/admin активен и синхронизирован.')
END

# Собираем статические файлы
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Запускаем сервер
echo "Starting server..."
gunicorn Backend.wsgi:application --bind 0.0.0.0:9000 --workers 4
