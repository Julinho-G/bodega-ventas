/**
 * Pruebas de punta a punta del frontend (Playwright): un navegador real usa la
 * aplicación como lo haría el cajero o el administrador.
 *
 *   npm run test:web          (desde frontend/ o desde la raíz del proyecto)
 *
 * Levanta sus PROPIOS servidores, aparte de los de "npm run dev":
 *   - API en el puerto 3001 con la base de datos "bodega_test", que se crea de cero
 *     en cada corrida (ver backend/scripts/api-pruebas.mjs). Tus datos reales no se tocan.
 *   - Frontend en el puerto 5174, apuntando a esa API.
 * Solo necesita Docker encendido (PostgreSQL).
 */
import { defineConfig } from '@playwright/test';

export const API_PRUEBAS = 'http://localhost:3001/api';
const WEB_PRUEBAS = 'http://localhost:5174';

// Navegador: en Windows, Microsoft Edge (ya viene instalado: no hay que descargar nada).
// PW_CHROMIUM permite usar otro Chromium indicando su ruta.
const navegador = process.env.PW_CHROMIUM
  ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } }
  : process.platform === 'win32'
    ? { channel: 'msedge' }
    : {};

export default defineConfig({
  testDir: './e2e',
  // Un archivo a la vez: comparten la misma base de datos
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_PRUEBAS,
    viewport: { width: 1366, height: 860 },
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    // Si algo falla: captura de pantalla y "trace" (paso a paso) en el reporte
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ...navegador,
  },
  webServer: [
    {
      name: 'API',
      command: 'node ../backend/scripts/api-pruebas.mjs',
      url: `${API_PRUEBAS}/health`,
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      name: 'Web',
      command: 'npm run dev -- --port 5174',
      url: WEB_PRUEBAS,
      env: { VITE_API_URL: API_PRUEBAS },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
