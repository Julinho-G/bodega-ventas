/**
 * Cliente para hablar con la API del backend.
 * - Agrega el token de sesión a cada petición.
 * - Convierte los errores del backend en un ErrorApi con un mensaje legible.
 */
const URL_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ErrorApi extends Error {
  readonly status: number;
  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.status = status;
  }
}

let token: string | null = null;
let alExpirarSesion: (() => void) | null = null;

/** La sesión registra aquí su token y qué hacer si el backend lo rechaza (401) */
export function configurarApi(
  nuevoToken: string | null,
  alExpirar: () => void,
) {
  token = nuevoToken;
  alExpirarSesion = alExpirar;
}

type Opciones = { metodo?: 'GET' | 'POST' | 'PATCH'; cuerpo?: unknown };

export async function api<T>(
  ruta: string,
  { metodo = 'GET', cuerpo }: Opciones = {},
): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(URL_BASE + ruta, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(
      0,
      'No hay conexión con el sistema. Revisa que la API esté encendida.',
    );
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    // NestJS devuelve "message" como texto o como lista (errores de validación)
    const mensaje: unknown = datos?.message;
    const texto = Array.isArray(mensaje)
      ? String(mensaje[0])
      : String(mensaje ?? `Error ${respuesta.status}`);
    // Token vencido o usuario desactivado: se cierra la sesión (salvo en el propio login)
    if (respuesta.status === 401 && token) alExpirarSesion?.();
    throw new ErrorApi(respuesta.status, texto);
  }
  return datos as T;
}
