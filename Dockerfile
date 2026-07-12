# Garm App — customer frontend (Vite/React) → static, served by nginx on :80.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# API URLs are baked in at build time (Vite). Override per environment.
ARG VITE_API_URL=/api
ARG VITE_ADMIN_API_URL=/admin-api/garm
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ADMIN_API_URL=$VITE_ADMIN_API_URL
# Served at domain root, so base = /.
RUN npx vite build --base=/

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
