/**
 * Las fechas de los filtros llegan como "AAAA-MM-DD" y se interpretan en hora de Lima (UTC-5).
 * Así "hoy" significa el día del Perú, aunque el servidor esté en otra zona horaria.
 */
export const ZONA_HORARIA = 'America/Lima';

export function inicioDelDia(fecha: string): Date {
  return new Date(`${fecha}T00:00:00-05:00`);
}

export function finDelDia(fecha: string): Date {
  return new Date(`${fecha}T23:59:59.999-05:00`);
}

/** Fecha de hoy en Lima, formato AAAA-MM-DD */
export function hoyEnLima(): string {
  // El formato en-CA produce exactamente AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(
    new Date(),
  );
}
