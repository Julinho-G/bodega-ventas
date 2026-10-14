# Sistema de Ventas – Bodega

Contexto del proyecto para Claude (VS Code / Claude Code). Responde y comenta el código **en español**.

## Qué es
Sistema de punto de venta (POS) para una bodega en Perú. Uso **solo presencial** (caja).
Proyecto de estudiante de Ingeniería de Sistemas: prioriza código claro, bien comentado y fácil de sustentar.

## Stack
- **Backend:** NestJS 11 + TypeScript (carpeta `backend/`)
- **ORM:** Prisma 7 con `@prisma/adapter-pg`. Cliente generado en `backend/src/generated/prisma` (no editar, no versionar).
- **Base de datos:** PostgreSQL 17 en Docker (`docker-compose.yml`), expuesto en el puerto **5440** (5432/5433 los ocupan PostgreSQL locales de Windows)
- **Frontend (pendiente):** React + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Query (carpeta `frontend/`)
- **Auth (hecho):** JWT (`@nestjs/jwt`) con roles `ADMIN` y `CAJERO`; contraseñas con `bcryptjs`

## Comandos (desde `backend/`)
- `npm run start:dev` – API en http://localhost:3000/api (salud: `/api/health`)
- `npm run db:migrate` – crear/aplicar migraciones tras cambiar `prisma/schema.prisma`
- `npx prisma db seed` – datos iniciales (usuario admin / admin123)
- `npm run db:studio` – ver la base de datos en el navegador
- `npm run lint`, `npm run test` y `npm run test:e2e` (e2e usa la BD del .env)
- `api.http` – peticiones de prueba (extensión REST Client)

## Reglas de negocio (no romper)
1. **Dinero y cantidades siempre `Decimal`**, nunca `float`/`number` para cálculos de montos. Usar `Prisma.Decimal` en la lógica.
2. `cantidad` y `stock` son decimales: se vende a granel (KG, LT) y por unidad (UND).
3. **Registrar una venta es una sola transacción** (`prisma.$transaction`): crear `Venta` + `DetalleVenta`, descontar `stock`, crear `MovimientoInventario` tipo `VENTA` (cantidad negativa). Si algo falla, se revierte todo.
4. Validar stock suficiente antes de vender; no permitir stock negativo.
5. `DetalleVenta.precioUnitario` guarda el precio del momento (histórico); nunca recalcular con el precio actual.
6. Todo cambio de stock pasa por `MovimientoInventario` (ENTRADA, VENTA, AJUSTE, MERMA). Nunca actualizar `stock` sin su movimiento.
7. Solo se puede vender con un `TurnoCaja` ABIERTO del usuario. Un usuario no puede tener dos turnos abiertos.
8. Método `FIADO` exige `clienteId` y no puede superar `limiteCredito` (deuda = ventas FIADO PAGADAS − pagos en `PagoFiado`).
9. Anular una venta = estado `ANULADA` + movimientos que devuelven el stock (no borrar registros).
10. Cierre de caja: esperado en efectivo = montoInicial + ventas EFECTIVO + pagos de fiado; YAPE/PLIN/TARJETA se reportan aparte.

## Convenciones
- Un módulo Nest por dominio: `auth`, `usuarios`, `categorias`, `productos`, `clientes`, `caja`, `ventas`, `inventario`, `reportes`.
- DTOs con `class-validator`; el `ValidationPipe` global usa `whitelist` y `forbidNonWhitelisted`.
- Rutas con prefijo `/api`. Nombres de código en español (camelCase); tablas en snake_case vía `@@map`.
- Inyectar `PrismaService` (módulo global) en los servicios; no instanciar `PrismaClient` en otros lugares.
- Configuración común de la app en `src/configurar-app.ts` (la usan `main.ts` y las pruebas e2e).

## Autenticación (cómo usarla en módulos nuevos)
- `JwtAuthGuard` y `RolesGuard` son **globales**: toda ruta exige token salvo las marcadas con `@Public()`.
- Restringir por rol: `@Roles(Rol.ADMIN)` en el método o en el controlador.
- Obtener quién hace la petición: parámetro `@UsuarioActual() usuario: UsuarioAutenticado` (tiene `id`, `nombre`, `usuario`, `rol`). Usar su `id` para `usuarioId` en ventas, turnos y movimientos; **nunca** recibir `usuarioId` en el body.
- Nunca devolver `passwordHash`: usar `select` con los campos públicos.
- Nombres de usuario se guardan en minúsculas.

## Montos y cantidades (Decimal)
- En los DTOs llegan como `number` con `@IsNumber({ maxDecimalPlaces: 2 })` (dinero) o `3` (cantidades).
- Convertir SIEMPRE con `aDecimal()` de `src/common/decimal.ts` antes de guardar o calcular; operar con métodos de Decimal (`plus`, `minus`, `times`, `lt`, `lte`...), nunca con `+ - *` de JavaScript.
- En las respuestas JSON los Decimal salen como **texto** (`"4.5"`); el frontend los convierte para mostrar.
- Productos `UND` solo admiten cantidades enteras; `KG`/`LT` hasta 3 decimales.
- Subtotales de venta: `precio × cantidad` redondeado a 2 decimales con `ROUND_HALF_UP`.

## Caja y ventas (cómo está implementado)
- `CajaService.obtenerTurnoAbierto(usuarioId, tx)` se usa dentro de transacciones; lanza 400 si no hay turno.
- Descontar stock SIEMPRE con `updateMany({ where: { id, stock: { gte: cantidad } }, data: { stock: { decrement } } })` y revisar `count`: evita stock negativo cuando dos cajas venden a la vez.
- Anular venta: `updateMany` condicionado a `estado: PAGADA` (evita doble anulación), devolver stock y crear movimientos `AJUSTE` positivos con el motivo. El cajero solo anula sus ventas con su turno abierto; el ADMIN cualquiera.
- La deuda de fiado vive en `ClientesService.deuda(clienteId, tx)`. Antes de fiar, cobrar o anular un fiado, llamar a `ClientesService.bloquear(clienteId, tx)` (`SELECT ... FOR UPDATE`) dentro de la transacción: evita superar el límite con operaciones simultáneas.
- Un fiado no se puede anular si dejaría la deuda del cliente en negativo (409).
- Solo el ADMIN asigna `limiteCredito`; cualquier usuario registra clientes y cobra pagos (con caja abierta).
- Pagos de fiado (`PagoFiado`) se asumen en efectivo y suman al efectivo esperado del turno.
- Fechas de filtros en formato `AAAA-MM-DD` interpretadas en hora de Lima (UTC-5): usar `inicioDelDia()` / `finDelDia()` de `src/common/fechas.ts`.
- Cada archivo e2e crea y borra sus propios datos; no depender de los productos del seed.

## Hoja de ruta
- [x] Fase 1: modelo de datos
- [x] Fase 2: entorno (Docker, NestJS, Prisma, seed)
- [ ] Fase 3: ~~Auth JWT + usuarios~~ ~~categorías/productos~~ ~~caja (turnos)~~ ~~ventas (transacción)~~ ~~clientes y fiado~~ ~~inventario~~ (hecho) → reportes
- [ ] Fase 4: Frontend (login, productos, pantalla de caja con lector de código de barras)
- [ ] Fase 5: Pruebas, Swagger, despliegue
- [ ] V2: boleta electrónica SUNAT, proveedores/compras

## Inventario (cómo está implementado)
- Ingresos, mermas y ajustes: solo ADMIN. Kardex: cualquier usuario. Listado de movimientos: ADMIN.
- Ingreso multi-producto en una transacción; puede actualizar `precioCompra` y `precioVenta`. Si el costo nuevo supera el precio de venta se rechaza TODO el ingreso.
- Merma: descuento condicionado (`stock >= cantidad`) y movimiento `MERMA` negativo con motivo obligatorio.
- Ajuste por conteo: recibe `stockReal`, bloquea el producto (`FOR UPDATE`) y registra la diferencia como `AJUSTE` (+ sobrante / − faltante).
- Invariante: `producto.stock` == suma de sus `MovimientoInventario.cantidad`. El kardex lo verifica en el campo `cuadra`.

