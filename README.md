# Sistema de Ventas – BODEGA D' CONSTANTINA

Punto de venta para la bodega: productos (por unidad y a granel), caja por turnos, ventas con Yape/Plin/efectivo/tarjeta, fiado e inventario auditable.

## Requisitos (instalar una sola vez)

| Herramienta | Versión | Descarga |
|---|---|---|
| Node.js | **24 LTS** (botón "LTS" de la página; Node 25 ya no recibe parches) | https://nodejs.org |
| Docker Desktop | reciente | https://www.docker.com/products/docker-desktop |
| Git | reciente | https://git-scm.com |
| VS Code + extensiones: Prisma, ESLint, Prettier | — | https://code.visualstudio.com |

Comprueba en una terminal:
```bash
node -v          # debe empezar con v24
docker -v
git --version
```

**Cambiar de versión de Node en Windows:** descarga el instalador **24 LTS** de https://nodejs.org y ejecútalo; reemplaza la versión que tengas. Luego cierra y vuelve a abrir VS Code, y reinstala las dependencias (`npm ci` dentro de `backend` y de `frontend`).

## Puesta en marcha

```bash
# 1. Base de datos (desde la carpeta raíz del proyecto)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # en Windows (PowerShell): copy .env.example .env
npm install                   # también genera el cliente de Prisma
npx prisma migrate dev --name init   # crea todas las tablas
npx prisma generate           # regenera el cliente de Prisma
npx prisma db seed            # carga admin/admin123, categorías y productos de ejemplo
npm run start:dev
```

Abre http://localhost:3000/api/health. Debe responder:
```json
{ "status": "ok", "db": "ok", ... }
```

```bash
# 3. Frontend (en OTRA terminal, con la API encendida)
cd frontend
cp .env.example .env          # en Windows (PowerShell): copy .env.example .env
npm install
npm run dev
```

Abre http://localhost:5173 e ingresa con `admin` / `admin123`.

Para ver las tablas y datos: `npm run db:studio`.

**Documentación de la API:** con la API encendida, abre http://localhost:3000/api/docs. Ahí están todas las rutas agrupadas por sección, con sus datos de entrada y quién puede usarlas. Para probarlas: ejecuta el login con **Try it out**, copia el `accessToken`, pulsa **Authorize** y pégalo. El JSON (`/api/docs-json`) se puede importar en Postman o Insomnia.

## Atajos desde la carpeta raíz

Desde `D:\bodega-ventas` (sin entrar a `backend`) también funcionan:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca la API (backend) |
| `npm run web` | Arranca la pantalla de caja (frontend) en http://localhost:5173 |
| `npm run test:e2e` | Corre las pruebas de punta a punta |
| `npm run db:migrate` | Aplica migraciones pendientes y regenera el cliente de Prisma |
| `npm run db:studio` | Abre el visor de la base de datos |

## Problemas comunes
- **`db: "sin conexión"`** → Docker Desktop no está abierto o el contenedor no arrancó: `docker compose ps`.
- **Puerto ocupado** → el proyecto usa el 5440 para no chocar con PostgreSQL instalados en Windows. Si también estuviera ocupado, cambia el primer número en `docker-compose.yml` y el puerto en `.env`.
- **El frontend dice "No hay conexión con el sistema"** → la API no está encendida: `npm run dev` en otra terminal.
- **`Port 5173 is already in use`** → ya tienes el frontend abierto en otra terminal.
- **`EADDRINUSE: address already in use :::3000`** → la API ya está encendida en otra terminal. Usa esa, o ciérrala: `netstat -ano | findstr :3000` y luego `taskkill /PID <número> /F`.
- **Cambié `schema.prisma`** → ejecuta `npm run db:migrate` (crea la migración y regenera el cliente).

## Estructura
```
bodega-ventas/
├── docker-compose.yml     PostgreSQL
├── CLAUDE.md              contexto para Claude en VS Code
├── frontend/              pantalla de caja (React + Vite)
│   └── src/
│       ├── lib/api.ts     cliente de la API (token y errores)
│       ├── sesion/        ingreso y cierre de sesión
│       ├── componentes/   botones, campos, cabecera
│       ├── venta/         buscador, carrito y cobro de la pantalla de venta
│       ├── productos/     formulario, ingresos/mermas/conteos y kardex
│       ├── clientes/      formulario y ficha con cobros y estado de cuenta
│       ├── reportes/      gráfico de columnas
│       └── paginas/       Ingreso, Vender, Ventas, Clientes, Caja, Productos, Reportes
└── backend/
    ├── prisma/
    │   ├── schema.prisma  modelo de datos
    │   └── seed.ts        datos iniciales
    ├── prisma.config.ts
    └── src/
        ├── main.ts        arranque (prefijo /api, validación, CORS)
        ├── configurar-documentacion.ts   Swagger en /api/docs
        ├── app.module.ts
        ├── prisma/        PrismaService global
        └── health/        GET /api/health
```

## Git (recomendado desde ya)
```bash
git init
git add .
git commit -m "Fase 2: entorno base con NestJS, Prisma y PostgreSQL"
```
