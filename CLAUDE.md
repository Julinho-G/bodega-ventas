# Sistema de Ventas – Bodega

Contexto del proyecto para Claude (VS Code / Claude Code). Responde y comenta el código **en español**.

## Qué es
Sistema de punto de venta (POS) para **BODEGA D' CONSTANTINA**, una bodega en Perú. Uso **solo presencial** (caja).
Proyecto de estudiante de Ingeniería de Sistemas: prioriza código claro, bien comentado y fácil de sustentar.

## Stack
- **Node.js 24 LTS** (`.nvmrc`, `engines` en los package.json). npm 11, que viene con Node 24: los `package-lock.json` necesitan npm 11 para `npm ci`.
- **Backend:** NestJS 11 + TypeScript (carpeta `backend/`)
- **ORM:** Prisma 7 (7.10.1, versión exacta igual en `prisma`, `@prisma/client` y `@prisma/adapter-pg`) con `@prisma/adapter-pg`. Cliente generado en `backend/src/generated/prisma` (no editar, no versionar).
- **Base de datos:** PostgreSQL 17 en Docker (`docker-compose.yml`), expuesto en el puerto **5440** (5432/5433 los ocupan PostgreSQL locales de Windows)
- **Frontend (hecho):** React 19 + Vite + TypeScript + Tailwind CSS 4 + TanStack Query + React Router (carpeta `frontend/`)
- **Auth (hecho):** JWT (`@nestjs/jwt`) con roles `ADMIN` y `CAJERO`; contraseñas con `bcryptjs`

## Comandos (desde `backend/`)
- `npm run start:dev` – API en http://localhost:3000/api (salud: `/api/health`)
- Documentación Swagger: http://localhost:3000/api/docs (JSON en `/api/docs-json`); se apaga con `API_DOCS=false`
- `npm run db:migrate` – crear/aplicar migraciones tras cambiar `prisma/schema.prisma`
- `npx prisma db seed` – datos iniciales (usuario admin / admin123)
- `npm run db:studio` – ver la base de datos en el navegador
- `npm run lint`, `npm run test` y `npm run test:e2e` (e2e usa la BD del .env)
- `api.http` – peticiones de prueba (extensión REST Client)
- `recorrido.http` – día completo en la bodega, paso a paso con el resultado ESPERADO

## Comandos del frontend (desde `frontend/`)
- `npm run dev` – http://localhost:5173 (puerto fijo: el backend solo acepta ese origen por CORS)
- `npm run build` (incluye `tsc`), `npm run lint` (oxlint), `npm run format` (prettier)
- Variables en `frontend/.env`: `VITE_API_URL`, `VITE_NOMBRE_BODEGA` (nombre de la tienda; si falta, `NOMBRE_BODEGA` de `src/lib/textos.ts` usa "BODEGA D' CONSTANTINA")
- Desde la raíz: `npm run web`
- `npm run test:web` – pruebas de las pantallas con Playwright (ver "Pruebas del frontend")

## Reglas de negocio (no romper)
1. **Dinero y cantidades siempre `Decimal`**, nunca `float`/`number` para cálculos de montos. Usar `Prisma.Decimal` en la lógica.
2. `cantidad` y `stock` son decimales: se vende a granel (KG, LT) y por unidad (UND).
3. **Registrar una venta es una sola transacción** (`prisma.$transaction`): crear `Venta` + `DetalleVenta`, descontar `stock`, crear `MovimientoInventario` tipo `VENTA` (cantidad negativa). Si algo falla, se revierte todo.
4. Validar stock suficiente antes de vender; no permitir stock negativo.
5. `DetalleVenta.precioUnitario` y `DetalleVenta.costoUnitario` guardan el precio y el costo del momento (histórico); nunca recalcular con los valores actuales del producto. La ganancia se calcula con `costoUnitario`.
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
- Dentro de `prisma.$transaction(async (tx) => ...)` NO usar `include` con varias relaciones ni `Promise.all`: Prisma lanza consultas en paralelo sobre la misma conexión (aviso de `pg` que será error en pg@9). Consultar paso a paso y leer el resultado con `include` después de la transacción.
- Descontar stock SIEMPRE con `updateMany({ where: { id, stock: { gte: cantidad } }, data: { stock: { decrement } } })` y revisar `count`: evita stock negativo cuando dos cajas venden a la vez.
- Anular venta: `updateMany` condicionado a `estado: PAGADA` (evita doble anulación), devolver stock y crear movimientos `AJUSTE` positivos con el motivo. El cajero solo anula sus ventas con su turno abierto; el ADMIN cualquiera.
- La deuda de fiado vive en `ClientesService.deuda(clienteId, tx)`. Antes de fiar, cobrar o anular un fiado, llamar a `ClientesService.bloquear(clienteId, tx)` (`SELECT ... FOR UPDATE`) dentro de la transacción: evita superar el límite con operaciones simultáneas.
- Un fiado no se puede anular si dejaría la deuda del cliente en negativo (409).
- Solo el ADMIN asigna `limiteCredito`; cualquier usuario registra clientes y cobra pagos (con caja abierta).
- Pagos de fiado (`PagoFiado`) se asumen en efectivo y suman al efectivo esperado del turno.
- Fechas de filtros en formato `AAAA-MM-DD` interpretadas en hora de Lima (UTC-5): usar `inicioDelDia()` / `finDelDia()` de `src/common/fechas.ts`.
- Cada archivo e2e crea y borra sus propios datos; no depender de los productos del seed.
- Búsquedas por nombre (productos y clientes) ignoran mayúsculas y TILDES con la extensión `unaccent` (migración `busqueda_sin_tildes`): `unaccent(nombre) ILIKE unaccent(patronContiene(texto))` vía `$queryRaw`. `patronContiene()` de `src/common/busqueda.ts` escapa `%` y `_`.

## Hoja de ruta
- [x] Fase 1: modelo de datos
- [x] Fase 2: entorno (Docker, NestJS, Prisma, seed)
- [x] Fase 3: Backend: auth JWT y usuarios, categorías y productos, caja (turnos), ventas (transacción), clientes y fiado, inventario, reportes: **backend completo**
- [x] Fase 4: Frontend: login, abrir/cerrar caja, pantalla de venta con lector de código de barras, historial y anulación, productos e inventario, clientes y fiado, reportes: **frontend completo**
- [x] Fase 5: Swagger, pruebas del frontend con Playwright y despliegue local con Docker (`produccion/`)
- [ ] V2: boleta electrónica SUNAT, proveedores/compras

## Documentación Swagger (cómo está implementada)
- `@nestjs/swagger` 11.4.7 trae `js-yaml` 5.3.0 con un aviso de seguridad: `overrides` en `backend/package.json` lo fija en 5.4.3. Quitarlo cuando una versión 11.x de Swagger traiga la corregida. No usar `npm audit fix --force` (instala Swagger 12, que exige NestJS 12).
- `src/configurar-documentacion.ts` arma el documento (título, guía de uso, `addBearerAuth`) y lo publica en `/api/docs`. Lo llaman `main.ts` y `test/documentacion.e2e-spec.ts`.
- El plugin de `@nestjs/swagger` (en `nest-cli.json`) lee los DTOs: tipos, opcionales, reglas de `class-validator` y los comentarios `/** */` como descripción. Por eso los DTOs deben terminar en `.dto.ts`.
- En los controladores el plugin está APAGADO a propósito (`controllerFileNameSuffix` con un sufijo que no existe): las respuestas son tipos de Prisma que el plugin no describe bien. Cada controlador lleva a mano `@ApiTags('Sección')`, `@ApiBearerAuth()` (salvo health; en auth solo `perfil`) y `@ApiOperation({ summary })` por ruta, con "· solo ADMIN" cuando corresponde.
- `@Roles()` agrega solo la respuesta 403 en la documentación.
- `@IsPositive()` se documentaría como "mínimo 1": esos campos llevan `@ApiProperty({ minimum: 0, exclusiveMinimum: true })` (o `ApiPropertyOptional` si son opcionales).
- Al agregar una ruta nueva: ponerle `@ApiOperation` y revisar que aparezca en `/api/docs`.

## Inventario (cómo está implementado)
- Ingresos, mermas y ajustes: solo ADMIN. Kardex: cualquier usuario. Listado de movimientos: ADMIN.
- Ingreso multi-producto en una transacción; puede actualizar `precioCompra` y `precioVenta`. Si el costo nuevo supera el precio de venta se rechaza TODO el ingreso.
- Merma: descuento condicionado (`stock >= cantidad`) y movimiento `MERMA` negativo con motivo obligatorio.
- Ajuste por conteo: recibe `stockReal`, bloquea el producto (`FOR UPDATE`) y registra la diferencia como `AJUSTE` (+ sobrante / − faltante).
- Invariante: `producto.stock` == suma de sus `MovimientoInventario.cantidad`. El kardex lo verifica en el campo `cuadra`.

## Reportes (cómo está implementado)
- Solo ADMIN. Periodo `desde`/`hasta` (AAAA-MM-DD); sin fechas = hoy en Lima (`hoyEnLima()`). Máximo un año.
- Consultas SQL con `$queryRaw`: agrupar por fecha usando `((v.fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')`, porque las fechas se guardan en UTC.
- En SQL crudo: `COUNT(*)::int` (evita BigInt en JSON) y sumas como `::text` convertidas a Decimal. Nunca interpolar texto del usuario con `Prisma.raw`; usar listas cerradas (ver `COLUMNA_ORDEN`).
- Ganancia por línea = `subtotal − ROUND(costo_unitario × cantidad, 2)`. Solo ventas PAGADAS; las anuladas se informan aparte.
- Las pruebas de reportes comparan ANTES/DESPUÉS porque la base puede tener ventas reales del día.

## Frontend (cómo está implementado)
- Todas las peticiones pasan por `api()` de `src/lib/api.ts`: agrega el token y convierte los errores de NestJS en `ErrorApi` (`status` + `message` legible). Un 401 con sesión abierta cierra la sesión.
- Datos del servidor con TanStack Query (`useQuery` / `useMutation`); después de modificar algo, `invalidateQueries` de la clave afectada (ej. `['caja']`).
- Sesión en `src/sesion/`: `ProveedorSesion` guarda `{ token, usuario }` en localStorage (`bodega.sesion`, siempre con try/catch) y la valida con `/auth/perfil` al abrir. Usar el hook `useSesion()`.
- Cabecera (`Marco.tsx`): menos de 1024 px → nombre de la tienda y "Salir" en la primera fila, secciones en la segunda (con scroll horizontal); desde 1024 px todo en una fila, y el nombre del usuario solo aparece desde 1280 px para que quepa.
- Rutas: `/ingresar` pública; el resto va dentro de `<Marco>` (exige sesión, muestra la cabecera con la navegación). `/` = Vender, `/ventas` = Ventas del turno, `/clientes` = Clientes, `/caja` = Mi caja, `/productos` = Productos y `/reportes` = Reportes (solo ADMIN: el enlace no se muestra al cajero y la página muestra un aviso).
- `GET /caja/actual` responde 200 con `{ turno: null, resumen: null }` si la caja está cerrada; `obtenerCaja()` lo convierte en `null`. Las acciones que SÍ exigen caja (vender, cerrar, cobrar fiado) siguen respondiendo 400.
- Montos: la API los envía como texto; `soles()` de `src/lib/dinero.ts` solo los formatea. Los cálculos de dinero se hacen en el backend. Para leer lo que escribe el usuario: `leerMonto()` (acepta coma o punto, máx. 2 decimales), `leerCantidad()` (> 0) y `leerCantidadOCero()` (≥ 0, para stock inicial/mínimo y conteos).
- Búsquedas mientras se escribe: `useRetrasado()` de `src/lib/useRetrasado.ts` (250 ms).
- Formularios: `onChange` en el `<form>` borra el aviso de error en cuanto el usuario corrige algo.
- Al guardar, en `onSuccess` se hace `await queryClient.invalidateQueries(...)` ANTES de mostrar el aviso de éxito: así el aviso y los datos en pantalla nunca se contradicen (el botón sigue en "Guardando…" mientras se recarga).
- Diseño: colores en `@theme` de `src/index.css` (`tinta`, `pared`, `papel`, `linea`, `cartulina`, `verde`, `rojo`, y `dato` = azul #2a6fd0 solo para barras de gráficos, validado en contraste y croma). El amarillo `cartulina` (componente `Etiqueta`, forma de cartel de precio) se usa SOLO para montos de dinero importantes. Cifras grandes con la utilidad `cifra`. Componentes base en `src/componentes/ui.tsx` (`Boton`, `Campo`, `Aviso`, `Etiqueta`).
- Textos de la interfaz en español claro, desde el punto de vista del cajero ("Abrir caja", "Efectivo que debe haber en el cajón").

## Pantalla de venta (cómo está implementada)
- `src/paginas/Vender.tsx` arma la pantalla; las piezas están en `src/venta/`: `carrito.ts` (useReducer), `Buscador.tsx`, `TablaCarrito.tsx`, `Cobro.tsx`.
- Buscador: Enter con solo dígitos (4+) = código de barras → `GET /productos/codigo/:codigo`; el campo se vacía ANTES de la petición (el lector puede estar escribiendo el siguiente código). Con texto = sugerencias de `GET /productos?buscar=` (espera 250 ms; solo se muestran si corresponden al texto actual). Multiplicador `6*código` o `6*nombre`.
- Carrito: la cantidad se guarda como texto tal como la escribe el cajero y se valida con `leerCantidad()` (UND enteros, KG/LT hasta 3 decimales). Agregar un producto que ya está suma a su línea (el backend rechaza productos repetidos). A granel se agrega sin cantidad y el foco pasa al campo de peso.
- Total en pantalla calculado en CÉNTIMOS enteros (`subtotalCentimos`, mismo redondeo que el backend); el total oficial es el que devuelve `POST /ventas`.
- Cobro: F2 cobra; efectivo con "Paga con" opcional y botones de billetes → vuelto en vivo; FIADO exige elegir cliente y bloquea si el total supera `creditoDisponible`. Tras cobrar se invalidan `['caja']`, `['productos']`, `['clientes']` y `['ventas']` y se muestra el vuelto que calculó el backend.

## Ventas del turno (cómo está implementado)
- `src/paginas/Ventas.tsx`: lista `GET /ventas?turnoId=<turno abierto>&limite=200` (clave `['ventas','turno',id]`) y detalle `GET /ventas/:id` en un panel al lado (debajo en pantallas angostas, con scroll automático).
- El resumen (cantidad y total) se calcula de la MISMA lista, en céntimos, para que nunca se contradigan mientras se refrescan las consultas.
- Anular: motivo obligatorio (botones con motivos frecuentes o texto libre, máx. 200) → `POST /ventas/:id/anular`. Luego se invalidan `['ventas']`, `['caja']`, `['productos']` y `['clientes']`. Una venta ANULADA se muestra tachada y ya no ofrece anular.
- El motivo queda en los movimientos de inventario (`AJUSTE`, "Anulación de venta #N: motivo"), no en la tabla `ventas`.

## Productos e inventario (cómo está implementado)
- `src/paginas/Productos.tsx`: lista paginada (30 por página) con búsqueda y filtros "En venta" / "Stock bajo" (`GET /productos/stock-bajo`, filtrado sin tildes en el cliente) / "Todos, con descontinuados" (`incluirInactivos=true`). A la derecha, la ficha del producto o el formulario de uno nuevo.
- `src/productos/FormProducto.tsx`: crear (`POST /productos`, con stock inicial) y editar (`PATCH`, incluye `activo` y `codigoBarras: null` para quitarlo). El stock NO se edita: solo cambia con movimientos. Muestra la ganancia por unidad como referencia.
- `src/productos/MovimientosStock.tsx`: "Llegó mercadería" (`POST /inventario/ingresos`, costo y precio nuevos opcionales), "Merma" (`/inventario/mermas`, motivo obligatorio) y "Conteo" (`/inventario/ajustes` con `stockReal`; si es igual al stock no se envía).
- `src/productos/Kardex.tsx`: `GET /inventario/kardex/:id` (clave `['kardex', id]`), lo más reciente primero, 15 filas con opción "ver todos", y el indicador `cuadra`.
- Tras cada cambio se invalidan `['productos']` (lista y ficha) y `['kardex', id]`.

## Clientes y fiado (cómo está implementado)
- `src/paginas/Clientes.tsx`: lista `GET /clientes` (`buscar`, `soloDeudores=true`) con resumen "N clientes deben S/ X"; a la derecha la ficha o el formulario de uno nuevo. Visible para todos los usuarios.
- `src/clientes/FormCliente.tsx`: crear/editar (DNI 8 dígitos, celular 9 dígitos que empieza con 9, `null` para borrarlos al editar). El campo de límite de crédito solo aparece para el ADMIN; al cajero se le explica que lo asigna el administrador.
- `src/clientes/PanelCliente.tsx`: `GET /clientes/:id/estado-cuenta` (clave `['clientes','cuenta',id]`): deuda en `Etiqueta`, límite y crédito disponible, cobro de pago a cuenta (`POST /clientes/:id/pagos`, botón "Todo", no deja cobrar más que la deuda) y estado de cuenta, lo más reciente primero.
- El pago entra al efectivo del turno: tras cobrar se invalidan `['clientes']` y `['caja']`.

## Reportes (frontend)
- `src/paginas/Reportes.tsx`: un selector de periodo arriba (Hoy, Ayer, Últimos 7 días, Este mes, Otro periodo con fechas) gobierna resumen, gráficos y ranking. Fechas en hora de Lima con `src/lib/fechas.ts` (`hoyEnLima`, `sumarDias`, `inicioDeMes`, `diasEntre`). Valida "desde ≤ hasta" y máximo un año antes de consultar.
- Usa `GET /reportes/resumen`, `GET /reportes/productos?orden=cantidad|importe|ganancia&limite=10` y `GET /reportes/inventario` (este último no depende del periodo). Al cambiar de periodo se conserva lo anterior con opacidad (`placeholderData`) en vez de parpadear.
- `src/reportes/Columnas.tsx`: gráfico de columnas de UNA serie hecho con HTML/CSS (sin librerías): columnas ≤ 24 px con punta redondeada de 4 px y 2 px de separación, cada columna es un botón (detalle al pasar el mouse o con Tab), se rotula solo la mayor, y "Ver como tabla" muestra todos los valores. Eje de horas en formato 24 h.
- Ventas por hora: de 7 a 21 como mínimo (se amplía si hubo ventas fuera). Ventas por día: se rellenan los días sin ventas si el periodo tiene hasta 62 días.

## Pruebas del frontend (cómo están implementadas)
- Playwright (`@playwright/test`, versión exacta) en `frontend/e2e/`, una prueba por pantalla: `ingreso-y-caja`, `venta`, `ventas-turno`, `productos`, `clientes`, `reportes`. Configuración en `frontend/playwright.config.ts`.
- Navegador: Microsoft Edge en Windows (`channel: 'msedge'`, no hay que descargar nada); `PW_CHROMIUM=<ruta>` usa otro Chromium.
- Servidores PROPIOS (`webServer`), aparte de los de desarrollo: API en 3001 y web en 5174 (`VITE_API_URL` apunta a 3001). La API la levanta `backend/scripts/api-pruebas.mjs`, que borra y crea la base `bodega_test` (mismo PostgreSQL, otra base), ejecuta los `migration.sql` en orden con `pg`, corre el seed con `tsx` y compila con `tsc` en `dist-pruebas/` (excluida en los tsconfig y en `.gitignore`), para no pisar el `dist/` de `npm run dev`.
- Como la base empieza igual en cada corrida, las pruebas usan los productos del seed por id (`PRODUCTO` en `e2e/ayudas.ts`) y montos exactos.
- Cada prueba que vende crea su propio cajero (`crearCajero()`): así cada una tiene su caja y no dependen del orden. Se corren de a una (`workers: 1`).
- `test` de `e2e/ayudas.ts` falla si la página tuvo errores de JavaScript; los datos se preparan con `llamar()` (API directa) y lo que se prueba se hace por pantalla.
- Al cambiar textos de la interfaz, actualizar las pruebas que los buscan.

## Producción (cómo está implementada)
- Despliegue LOCAL en la laptop/PC de la bodega con Docker (funciona sin internet, costo S/ 0). Guía para el usuario: `produccion/INSTALAR.md`.
- `produccion/docker-compose.yml` (proyecto `bodega-produccion`, aparte del compose de desarrollo): `db` (PostgreSQL 17, sin puertos publicados, volumen `datos`), `api`, `web` (Caddy en `PUERTO`, por defecto 8080) y `respaldos`. Variables en `produccion/.env` (plantilla `.env.example`): `DB_PASSWORD`, `JWT_SECRET`, `ADMIN_PASSWORD`, `NOMBRE_BODEGA`, `PUERTO`, `CARPETA_RESPALDOS`, `DIAS_A_GUARDAR`.
- `backend/Dockerfile`: compila en una etapa; la imagen final tiene solo dependencias de producción (`prisma` está en `dependencies` para poder ejecutar `migrate deploy`). Al arrancar: `prisma migrate deploy` → `node dist/inicializar.js` → `node dist/main.js`.
- `src/inicializar.ts`: si no hay usuarios crea `admin` con `ADMIN_PASSWORD` (mínimo 8, si falta la API no arranca); si no hay categorías crea `CATEGORIAS_INICIALES` (`src/common/categorias-iniciales.ts`, compartidas con el seed). Nunca crea productos de ejemplo.
- Con `NODE_ENV=production` la API exige `JWT_SECRET` de 32 caracteres o más (`auth.module.ts`). Swagger apagado (`API_DOCS=false`).
- `frontend/Dockerfile` compila con `VITE_API_URL=/api` (misma dirección, sin CORS) y sirve con Caddy (`frontend/Caddyfile`): `/api/*` → `api:3000`; lo demás → `/srv` con `try_files` a `index.html`; `/assets/*` en caché un año, el resto `no-cache`.
- `produccion/respaldar.sh` (contenedor `respaldos`): `pg_dump -Fc` si la última copia tiene más de 20 h, revisa cada hora, borra las de más de `DIAS_A_GUARDAR` días; `sh /respaldar.sh ahora` hace una al momento. `restaurar.sh <archivo>` guarda antes el estado actual y restaura con `pg_restore --clean --single-transaction` (con la API detenida).
- npm 11 bloquea los scripts de instalación de las dependencias que no están aprobados: `allowScripts` en `backend/package.json` aprueba `prisma` y `@prisma/engines` (descargan el motor de migraciones) y rechaza el resto. Si una dependencia nueva necesita su script, aprobarla con `npm install-scripts approve <paquete>`.
- Atajos desde la raíz: `npm run prod:instalar`, `prod:estado`, `prod:logs`, `prod:respaldar`.
- Pendiente para producción: no hay pantalla de usuarios (crear cajeros o cambiar contraseñas se hace por la API: `POST /usuarios`, `PATCH /usuarios/:id`).

