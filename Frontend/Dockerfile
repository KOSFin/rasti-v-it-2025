FROM node:20-alpine AS builder
ARG VITE_API_BASE_URL=https://api-hak-3.ruka.me
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm ls prop-types || npm install prop-types
RUN npm run build || (echo "❌ Build failed. Check missing dependencies." && exit 1)
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
