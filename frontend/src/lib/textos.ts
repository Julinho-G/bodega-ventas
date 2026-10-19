/** Nombres para mostrar en pantalla (la API usa códigos en mayúsculas) */
import type { MetodoPago, TipoMovimiento, Unidad } from '../tipos';

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

export const NOMBRE_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ENTRADA: 'Entrada',
  VENTA: 'Venta',
  AJUSTE: 'Ajuste',
  MERMA: 'Merma',
};

/** "2026-10-16T14:05:00Z" → "16/10" en hora de Lima */
export const diaMes = (fecha: string) =>
  new Date(fecha).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Lima',
  });
