import { api, ErrorApi } from './api';
import type { ResumenTurno, Turno } from '../tipos';

export type CajaActual = { turno: Turno; resumen: ResumenTurno };

/** Clave de TanStack Query para el turno abierto del usuario */
export const CLAVE_CAJA = ['caja', 'actual'] as const;

/** El backend responde 400 cuando el usuario no tiene caja abierta: eso es "caja cerrada", no un error */
export async function obtenerCaja(): Promise<CajaActual | null> {
  try {
    return await api<CajaActual>('/caja/actual');
  } catch (error) {
    if (error instanceof ErrorApi && error.status === 400) return null;
    throw error;
  }
}
