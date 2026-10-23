# Imagen de las pantallas para PRODUCCIÓN (la usa produccion/docker-compose.yml).
# 1) Vite compila la aplicación a archivos estáticos. 2) Caddy los sirve y pasa /api a la API.

# ---------- 1. Compilar ----------
FROM node:24-alpine AS compilar
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# La API está en la MISMA dirección (Caddy la atiende en /api): no hace falta CORS
ARG NOMBRE_BODEGA="BODEGA D' CONSTANTINA"
ENV VITE_API_URL=/api \
    VITE_NOMBRE_BODEGA=${NOMBRE_BODEGA}
RUN npm run build

# ---------- 2. Servir ----------
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=compilar /app/dist /srv
