/**
 * API para las pruebas del frontend (Playwright). La ejecuta "npm run test:web".
 *
 * Usa una base de datos APARTE, "bodega_test", para no tocar nunca los datos reales:
 *   1. Borra y vuelve a crear bodega_test (en el mismo PostgreSQL de Docker).
 *   2. Aplica todas las migraciones (los archivos migration.sql, en orden).
 *   3. Carga los datos iniciales (seed): admin / admin123 y productos de ejemplo.
 *   4. Compila la API en "dist-pruebas" (no toca "dist", que usa "npm run dev").
 *   5. Levanta la API en el puerto 3001, aceptando al frontend de pruebas (5174).
 *
 * Así cada corrida de pruebas empieza exactamente con los mismos datos.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_PRUEBAS = 'bodega_test';
const PUERTO_API = '3001';
const URL_FRONTEND = 'http://localhost:5174';

// La conexión real sale de backend/.env (si ya viene en el entorno, se respeta)
try {
  process.loadEnvFile(join(BACKEND, '.env'));
} catch {
  // Sin .env: se usan las variables del entorno
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en backend/.env');
  process.exit(1);
}

// Misma conexión, pero apuntando a bodega_test
const urlReal = new URL(process.env.DATABASE_URL);
const urlPruebas = new URL(urlReal);
urlPruebas.pathname = `/${BASE_PRUEBAS}`;
if (urlReal.pathname === urlPruebas.pathname) {
  console.error(
    `Tu base de datos real se llama "${BASE_PRUEBAS}": cámbiale el nombre para no borrarla.`,
  );
  process.exit(1);
}

/** Conexión para pg (sin "?schema=public", que es solo para Prisma) */
function conexion(url, base) {
  const u = new URL(url);
  u.pathname = `/${base}`;
  u.search = '';
  return new pg.Client({ connectionString: u.toString() });
}

/** Ejecuta un comando de Node dentro de backend/ y se detiene si falla */
function ejecutar(paso, args, env) {
  console.log(`[api-pruebas] ${paso}…`);
  const r = spawnSync(process.execPath, args, {
    cwd: BACKEND,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error(`[api-pruebas] Falló: ${paso}`);
    process.exit(r.status ?? 1);
  }
}

// 1. Base de datos nueva (WITH (FORCE) cierra conexiones que hayan quedado abiertas)
console.log(`[api-pruebas] Creando la base de datos "${BASE_PRUEBAS}"…`);
const admin = conexion(urlReal, 'postgres');
try {
  await admin.connect();
} catch (e) {
  console.error(
    `[api-pruebas] No se pudo conectar a PostgreSQL (${e.message}). ¿Está Docker encendido? Prueba: docker compose up -d`,
  );
  process.exit(1);
}
await admin.query(`DROP DATABASE IF EXISTS ${BASE_PRUEBAS} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${BASE_PRUEBAS}`);
await admin.end();

// 2. Migraciones en orden (las carpetas empiezan con la fecha)
const carpeta = join(BACKEND, 'prisma', 'migrations');
const migraciones = readdirSync(carpeta, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const bd = conexion(urlReal, BASE_PRUEBAS);
await bd.connect();
for (const nombre of migraciones) {
  await bd.query(readFileSync(join(carpeta, nombre, 'migration.sql'), 'utf8'));
}
await bd.end();
console.log(`[api-pruebas] ${migraciones.length} migraciones aplicadas.`);

const entorno = {
  DATABASE_URL: urlPruebas.toString(),
  PORT: PUERTO_API,
  FRONTEND_URL: URL_FRONTEND,
  API_DOCS: 'false',
};

// 3. Datos iniciales
ejecutar(
  'Cargando datos iniciales',
  ['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts'],
  entorno,
);

// 4. Compilar en una carpeta propia (se vacía antes para no mezclar con la corrida anterior)
rmSync(join(BACKEND, 'dist-pruebas'), { recursive: true, force: true });
ejecutar('Compilando la API', [
  'node_modules/typescript/bin/tsc',
  '-p',
  'tsconfig.build.json',
  '--outDir',
  'dist-pruebas',
  '--declaration',
  'false',
  '--incremental',
  'false',
]);

// 5. Levantar la API (Playwright la detiene al terminar)
console.log(
  `[api-pruebas] API de pruebas en http://localhost:${PUERTO_API}/api`,
);
const api = spawn(process.execPath, ['dist-pruebas/main.js'], {
  cwd: BACKEND,
  env: { ...process.env, ...entorno },
  stdio: 'inherit',
});
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => api.kill(senal));
}
api.on('exit', (codigo) => process.exit(codigo ?? 0));
