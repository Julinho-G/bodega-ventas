/** Nombres para mostrar en pantalla (la API usa códigos en mayúsculas) */
import type { MetodoPago, Unidad } from '../tipos';

export const NOMBRE_METODO: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TARJETA: 'Tarjeta',
  FIADO: 'Fiado',
};

export const NOMBRE_UNIDAD: Record<Unidad, string> = {
  UND: 'und',
  KG: 'kg',
  LT: 'L',
};

/** "2026-10-16T14:05:00Z" → "9:05 a. m." en hora de Lima */
export const hora = (fecha: string) =>
  new Date(fecha).toLocaleTimeString('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Lima',
  });
