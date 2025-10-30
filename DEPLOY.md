# Инструкция по развертыванию системы РАСТИ В ИТ

## Подготовка сервера

### Требования
- Linux-сервер (Ubuntu 20.04+ или аналог)
- Docker и Docker Compose установлены
- Минимум 2GB RAM, 20GB диска
- Открытые порты: 80 (HTTP), 443 (HTTPS), 8000 (API)

### Установка Docker и Docker Compose

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавить пользователя в группу docker
sudo usermod -aG docker $USER

# Установить Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Проверить установку
docker --version
docker-compose --version
```

## Вариант 1: Развертывание всей системы (рекомендуется)

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd rasti-v-it
```

### 2. Настройка переменных окружения

#### Backend

```bash
cd Backend
cp .env.example .env
nano .env
```

Установите следующие значения:

```env
DEBUG=False
SECRET_KEY=<генерируйте_длинный_случайный_ключ>
ALLOWED_HOSTS=your-domain.com,www.your-domain.com,your-server-ip
DB_NAME=rasti_db
DB_USER=postgres
DB_PASSWORD=<strong_password>
DB_HOST=db
DB_PORT=5432
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

#### Frontend

```bash
cd ../Frontend
cp .env.example .env
nano .env
```

```env
VITE_API_URL=https://api.your-domain.com
# или
VITE_API_URL=http://your-server-ip:8000
```

### 3. Настройка docker-compose для production

Отредактируйте корневой `docker-compose.yml`:

```bash
cd ..
nano docker-compose.yml
```

Измените настройки безопасности:
- Смените пароли БД
- Обновите SECRET_KEY
- Настройте правильные домены

### 4. Запуск системы

```bash
# Собрать и запустить все сервисы
docker-compose up -d --build

# Проверить статус
docker-compose ps

# Посмотреть логи
docker-compose logs -f
```

### 5. Применение миграций (автоматически выполняется при запуске)

Если нужно вручную:

```bash
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
```

### 6. Сбор статических файлов

```bash
docker-compose exec backend python manage.py collectstatic --noinput
```

## Вариант 2: Раздельное развертывание

### Backend отдельно

```bash
cd Backend

# Создать и настроить .env
cp .env.example .env
nano .env

# Запустить
docker-compose up -d --build

# Проверить
curl http://localhost:8000/api/auth/login/
```

### Frontend отдельно

```bash
cd Frontend

# Создать и настроить .env
cp .env.example .env
nano .env

# Собрать Docker образ
docker build -t rasti-frontend --build-arg VITE_API_URL=http://your-api-url .

# Запустить
docker run -d -p 80:80 rasti-frontend
```

## Настройка Nginx для реверс-прокси (опционально)

Если хотите использовать один домен для всей системы:

```bash
sudo nano /etc/nginx/sites-available/rasti
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django Admin
    location /admin {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static files
    location /static {
        proxy_pass http://localhost:8000;
    }
}
```

```bash
# Активировать конфигурацию
sudo ln -s /etc/nginx/sites-available/rasti /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Настройка SSL с Let's Encrypt

```bash
# Установить certbot
sudo apt install certbot python3-certbot-nginx -y

# Получить сертификат
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Certbot автоматически настроит nginx для HTTPS
```

## Резервное копирование

### Создание backup базы данных

```bash
# Создать backup
docker-compose exec db pg_dump -U postgres rasti_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из backup
docker-compose exec -T db psql -U postgres rasti_db < backup_file.sql
```

### Backup всего приложения

```bash
# Создать полный backup
tar -czf rasti_backup_$(date +%Y%m%d).tar.gz \
    Backend/ Frontend/ docker-compose.yml

# Backup только данных
docker-compose exec db pg_dump -U postgres rasti_db | gzip > db_backup.sql.gz
```

## Мониторинг и обслуживание

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Только backend
docker-compose logs -f backend

# Только БД
docker-compose logs -f db

# Последние 100 строк
docker-compose logs --tail=100
```

### Перезапуск сервисов

```bash
# Перезапустить все
docker-compose restart

# Перезапустить конкретный сервис
docker-compose restart backend
docker-compose restart frontend
```

### Обновление приложения

```bash
# Остановить сервисы
docker-compose down

# Получить последние изменения
git pull origin main

# Пересобрать и запустить
docker-compose up -d --build

# Применить миграции (если есть)
docker-compose exec backend python manage.py migrate
```

### Очистка

```bash
# Удалить неиспользуемые образы
docker system prune -a

# Удалить volumes (ВНИМАНИЕ: удалит БД!)
docker-compose down -v
```

## Troubleshooting

### Backend не запускается

```bash
# Проверить логи
docker-compose logs backend

# Проверить БД
docker-compose exec db psql -U postgres -c "SELECT version();"

# Перезапустить с пересборкой
docker-compose up -d --build --force-recreate backend
```

### Frontend не отображается

```bash
# Проверить логи nginx внутри контейнера
docker-compose exec frontend cat /var/log/nginx/error.log

# Проверить переменные окружения
docker-compose exec frontend env | grep VITE

# Пересобрать с правильными переменными
docker-compose build --no-cache --build-arg VITE_API_URL=http://your-api frontend
```

### Проблемы с CORS

Убедитесь что в Backend/.env:
```env
CORS_ALLOWED_ORIGINS=https://your-frontend-domain,http://your-frontend-ip
```

### База данных недоступна

```bash
# Проверить healthcheck
docker-compose ps

# Проверить подключение
docker-compose exec backend python manage.py dbshell

# Пересоздать volumes
docker-compose down -v
docker-compose up -d
```

## Безопасность

### Чек-лист безопасности

- [ ] DEBUG=False в production
- [ ] Сильный SECRET_KEY (минимум 50 символов)
- [ ] Сильные пароли для БД
- [ ] HTTPS настроен через Let's Encrypt
- [ ] Firewall настроен (ufw/iptables)
- [ ] Регулярные backup
- [ ] Обновления системы и Docker
- [ ] Ограничен доступ к портам БД
- [ ] Настроен fail2ban для защиты от брутфорса

### Настройка firewall

```bash
# Разрешить SSH, HTTP, HTTPS
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Производительность

### Для production рекомендуется:

1. Увеличить количество workers в Gunicorn:
   - Отредактировать Backend/entrypoint.sh
   - Изменить `--workers 4` на `--workers $(nproc)`

2. Настроить кэширование в Django (Redis/Memcached)

3. Использовать CDN для статических файлов

4. Настроить мониторинг (Prometheus + Grafana)

## Контакты и поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose logs`
2. Проверьте статус: `docker-compose ps`
3. Изучите документацию в README.md
