#!/bin/bash

# Ожидаем готовности БД
echo "Waiting for PostgreSQL..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 0.1
done
echo "PostgreSQL started"

# Применяем миграции
echo "Applying database migrations..."
python manage.py makemigrations
python manage.py migrate

# Создаем суперпользователя, если не существует
echo "Creating superuser..."
python manage.py shell << END
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin')
    print('Superuser created.')
else:
    print('Superuser already exists.')
END

# Собираем статические файлы
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Запускаем сервер
echo "Starting server..."
gunicorn Backend.wsgi:application --bind 0.0.0.0:8000 --workers 4
