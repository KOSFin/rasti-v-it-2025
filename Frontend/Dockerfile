# Multi-stage build для production
FROM node:18-alpine AS builder

# Аргумент для API URL
ARG VITE_API_URL=https://api.hak-rosti-v-it.ruka.me

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci || npm install

# Копируем исходный код
COPY . .

# Устанавливаем переменные окружения для сборки
ENV VITE_API_URL=$VITE_API_URL

# Собираем приложение
RUN npm run build

# Production stage с nginx
FROM nginx:alpine AS production

# Копируем собранное приложение из builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Удаляем дефолтную конфигурацию nginx
RUN rm -f /etc/nginx/conf.d/default.conf

# Копируем нашу конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт 80
EXPOSE 80

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]
