# Imagen de la API para PRODUCCIÓN (la usa produccion/docker-compose.yml).
# Dos etapas: en la primera se compila; en la segunda solo queda lo necesario para correr.

# ---------- 1. Compilar ----------
FROM node:24-alpine AS compilar
# Prisma necesita OpenSSL para su motor de migraciones
RUN apk add --no-cache openssl
WORKDIR /app

# Primero solo las dependencias: Docker reutiliza esta capa si no cambiaron
# tsconfig.json va aquí porque "npm ci" ejecuta "prisma generate", y Prisma lo lee para decidir
# la extensión de los imports del cliente: sin él usaría ".ts" y dist/ no los encontraría
COPY package.json package-lock.json prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
RUN npm ci

COPY nest-cli.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---------- 2. Ejecutar ----------
FROM node:24-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    TZ=America/Lima
WORKDIR /app

# Solo dependencias de producción (incluye la CLI de Prisma para "migrate deploy")
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=compilar /app/dist ./dist

# No correr como administrador del contenedor
USER node
EXPOSE 3000

# Al arrancar: 1) aplica migraciones pendientes, 2) crea admin y categorías si la base
# está vacía, 3) inicia la API ("exec" para que reciba bien la señal de apagado)
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/inicializar.js && exec node dist/main.js"]
