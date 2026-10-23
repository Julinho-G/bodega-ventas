# Instalar el sistema en la laptop (modo producción)

Esta guía instala **BODEGA D' CONSTANTINA** para usarlo de verdad en la tienda. Todo es gratis y funciona **sin internet**.

Queda **separado** de lo que usas para programar. Las ventas reales viven en su propia base de datos, así que `npm run dev`, `npm run test:e2e` o `npm run test:web` nunca las tocan.

| | Desarrollo (`npm run dev` + `npm run web`) | Producción (esta guía) |
|---|---|---|
| Dirección | localhost:5173 | **http://localhost:8080** |
| Base de datos | `bodega_db` (pruebas) | `bodega` en el volumen `bodega-produccion_datos` |
| Arranque | 2 terminales abiertas | Solo, al prender la laptop |

---

## 1. Requisitos

- **Docker Desktop** abierto (el mismo que ya usas).
- El proyecto en `D:\bodega-ventas`.

## 2. Configurar (una sola vez)

En PowerShell:

```powershell
cd D:\bodega-ventas\produccion
copy .env.example .env
```

Para generar una clave aleatoria, ejecuta esto **tres veces** y copia cada resultado:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
```

Abre `produccion\.env` en VS Code y completa los valores:

| Variable | Qué poner |
|---|---|
| `DB_PASSWORD` | La primera clave generada |
| `JWT_SECRET` | La segunda clave generada |
| `ADMIN_PASSWORD` | La contraseña con la que **tú** vas a entrar como `admin` (mínimo 8 caracteres). Anótala. |
| `CARPETA_RESPALDOS` | Una carpeta de OneDrive, por ejemplo `C:/Users/ASUS/OneDrive/Respaldos bodega` (con `/`). Así las copias también quedan en la nube. Crea la carpeta antes. |

> ⚠️ **No cambies `DB_PASSWORD` después de instalar.** La base se crea con esa clave la primera vez. Si luego la cambias, la API ya no podrá conectarse.

## 3. Instalar

```powershell
cd D:\bodega-ventas\produccion
docker compose up -d --build
```

La primera vez tarda unos minutos: descarga las imágenes y compila el sistema. Para comprobar que todo funciona:

```powershell
docker compose ps
```

Deben aparecer 4 servicios en estado `running`: `db` (healthy), `api`, `web` y `respaldos`. Para ver que la API creó tu usuario:

```powershell
docker compose logs api
```

Debe decir `[inicializar] Usuario "admin" creado` y `6 categorías creadas`.

## 4. Abrir el sistema como una aplicación

1. En **Microsoft Edge**, abre **http://localhost:8080** e ingresa con `admin` y tu `ADMIN_PASSWORD`.
2. Menú **⋯ → Aplicaciones → Instalar este sitio como aplicación**.
3. Queda un ícono **BODEGA D' CONSTANTINA** en el escritorio y en el menú Inicio, que se abre en su propia ventana.

La base empieza **vacía**: sin los productos de ejemplo de desarrollo. Registra tus productos en **Productos → Nuevo producto**.

## 5. Que arranque solo

- **Docker Desktop → Settings → General →** marca **"Start Docker Desktop when you sign in to your computer"**.
- Los contenedores tienen `restart: unless-stopped`: cuando Docker arranca, el sistema arranca también.
- **Windows → Configuración → Sistema → Energía:** que la laptop **no se suspenda** mientras está enchufada (así no se corta en plena atención).

## 6. Copias de seguridad

Son **automáticas**. Mientras el sistema está prendido, se hace una copia al día en `CARPETA_RESPALDOS`, por ejemplo `bodega-2026-10-23_2200.dump`. Se guardan 30 días y las más antiguas se borran solas.

Para hacer una copia **ahora mismo** (por ejemplo, antes de actualizar el sistema):

```powershell
docker compose exec respaldos sh /respaldar.sh ahora
```

### Restaurar una copia

Solo si pasó algo grave, como una base dañada o datos borrados por error:

```powershell
docker compose stop api
docker compose exec respaldos sh /restaurar.sh                       # lista las copias disponibles
docker compose exec respaldos sh /restaurar.sh bodega-2026-10-23_2200.dump
docker compose start api
```

Antes de restaurar, el script guarda el estado actual como `antes-de-restaurar-....dump`, por si te equivocas de archivo.

**Si se malogra o roban la laptop:** instala Docker en otra PC y sigue esta guía desde el paso 2, con la misma `CARPETA_RESPALDOS` de OneDrive. Después restaura la copia más reciente.

## 7. Actualizar el sistema

Cuando mejores el código y sus pruebas pasen (`npm run test:e2e` y `npm run test:web`):

```powershell
cd D:\bodega-ventas\produccion
docker compose exec respaldos sh /respaldar.sh ahora   # por si acaso
docker compose up -d --build
```

Tus ventas se conservan. Si hay migraciones nuevas, la API las aplica sola al arrancar.

## 8. Usarlo desde un celular o tablet de la tienda

Si están conectados al **mismo WiFi** que la laptop:

1. En la laptop, ejecuta `ipconfig` y anota la "Dirección IPv4" (por ejemplo `192.168.1.35`).
2. En el celular, abre `http://192.168.1.35:8080`.
3. Si Windows pregunta por el firewall la primera vez, permite el acceso en **redes privadas**.

## Comandos útiles (desde `produccion/`)

| Comando | Qué hace |
|---|---|
| `docker compose ps` | Ver si todo está funcionando |
| `docker compose logs -f api` | Ver lo que pasa en la API (Ctrl + C para salir) |
| `docker compose restart api` | Reiniciar la API |
| `docker compose down` | Apagar el sistema (los datos **se conservan**) |
| `docker compose up -d` | Prenderlo de nuevo |

Desde la raíz del proyecto también funcionan `npm run prod:instalar`, `npm run prod:estado`, `npm run prod:logs` y `npm run prod:respaldar`.

> 🚫 **Nunca uses `docker compose down -v`.** La `-v` borra el volumen con **todas las ventas**.

## Problemas comunes

- **`docker compose ps` muestra `api` reiniciándose:** mira `docker compose logs api`.
  - `falta ADMIN_PASSWORD`: completa esa variable en `.env`. Solo se pide cuando la base está vacía.
  - `JWT_SECRET debe tener al menos 32 caracteres`: usa una clave generada como en el paso 2.
  - `password authentication failed`: cambiaste `DB_PASSWORD` después de instalar. Vuelve a poner la clave original.
- **`port is already allocated` (8080 ocupado):** cambia `PUERTO=8081` en `.env` y abre `http://localhost:8081`.
- **No aparecen copias en OneDrive:** revisa que la ruta de `CARPETA_RESPALDOS` exista, use `/` y que `docker compose logs respaldos` diga `Copia lista`.
- **Después de actualizar no ves los cambios:** recarga con **Ctrl + F5**.
