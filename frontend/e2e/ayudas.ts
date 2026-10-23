/**
 * Ayudas compartidas por las pruebas del frontend.
 * - `test`: igual al de Playwright, pero además falla si la página tuvo errores de JavaScript.
 * - `llamar()`: habla directo con la API de pruebas para preparar datos (más rápido que por pantalla).
 */
import { test as base, expect, type Page } from '@playwright/test';

export const API = 'http://localhost:3001/api';
export { expect };

export const test = base.extend<{ erroresDeLaPagina: string[] }>({
  erroresDeLaPagina: [
    async ({ page }, usar) => {
      const errores: string[] = [];
      page.on('pageerror', (e) => errores.push(e.message));
      page.on('console', (m) => {
        // Las respuestas 4xx esperadas (ej. "stock insuficiente") también salen en la
        // consola como "Failed to load resource"; esas no son errores del frontend.
        if (
          m.type() === 'error' &&
          !m.text().startsWith('Failed to load resource')
        )
          errores.push(m.text());
      });
      await usar(errores);
      expect(errores, 'errores de JavaScript en la página').toEqual([]);
    },
    { auto: true },
  ],
});

type Opciones = {
  token?: string;
  cuerpo?: unknown;
  metodo?: 'GET' | 'POST' | 'PATCH';
};

/** Petición a la API de pruebas. Lanza un error si no responde 2xx. */
export async function llamar<T = any>(
  ruta: string,
  {
    token,
    cuerpo,
    metodo = cuerpo === undefined ? 'GET' : 'POST',
  }: Opciones = {},
): Promise<T> {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const datos = await r.json().catch(() => null);
  if (!r.ok)
    throw new Error(
      `${metodo} ${ruta} → ${r.status}: ${JSON.stringify(datos)}`,
    );
  return datos as T;
}

export async function tokenDe(usuario: string, password: string) {
  const r = await llamar<{ accessToken: string }>('/auth/login', {
    cuerpo: { usuario, password },
  });
  return r.accessToken;
}

export const tokenAdmin = () => tokenDe('admin', 'admin123');

let contador = 0;
/** Texto único para nombres de prueba (la base empieza vacía en cada corrida, pero así no chocan entre archivos) */
export const unico = () => `${Date.now().toString().slice(-5)}${contador++}`;

/** Crea un cajero nuevo. Cada prueba usa el suyo: así cada una tiene su propia caja. */
export async function crearCajero(nombre: string) {
  const usuario = `cajero${unico()}`;
  await llamar('/usuarios', {
    token: await tokenAdmin(),
    cuerpo: { nombre, usuario, password: 'caja123' },
  });
  return {
    usuario,
    password: 'caja123',
    token: await tokenDe(usuario, 'caja123'),
  };
}

/** Ingresa por la pantalla de inicio de sesión */
export async function ingresar(page: Page, usuario: string, password: string) {
  await page.goto('/ingresar');
  await page.fill('#usuario', usuario);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.locator('nav[aria-label=Secciones]').waitFor();
}

/** IDs de los productos que crea el seed (la base de pruebas siempre empieza igual) */
export const PRODUCTO = {
  arroz: 1, // Arroz Costeño 750 g · S/ 4.50 · código 7750243001234
  azucar: 2, // Azúcar rubia (granel) · S/ 4.00 el kg
  aceite: 3, // Aceite Primor 1 L · S/ 10.50
  incaKola: 4, // Inca Kola 500 ml · S/ 2.50
  leche: 5, // Leche Gloria tarro 400 g · S/ 4.30
  pan: 6, // Pan francés · S/ 0.20
} as const;

/** Formato de dinero igual al de la pantalla: S/ 1,234.50 */
export const soles = (v: string | number) =>
  'S/ ' +
  new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v));

/** Ancho total de la página: si es mayor que la ventana, hay scroll horizontal */
export const anchoDePagina = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth);
