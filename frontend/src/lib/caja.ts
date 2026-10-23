import { api } from './api';
import type { ResumenTurno, Turno } from '../tipos';

export type CajaActual = { turno: Turno; resumen: ResumenTurno };

/** Clave de TanStack Query para el turno abierto del usuario */
export const CLAVE_CAJA = ['caja', 'actual'] as const;

type Respuesta = CajaActual | { turno: null; resumen: null };

/** Turno abierto del usuario, o null si tiene la caja cerrada */
export async function obtenerCaja(): Promise<CajaActual | null> {
  const r = await api<Respuesta>('/caja/actual');
  return r.turno ? r : null;
}
