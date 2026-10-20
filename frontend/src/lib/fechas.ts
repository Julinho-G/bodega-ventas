/**
 * Fechas de calendario en hora de Lima, como texto "AAAA-MM-DD"
 * (el formato que piden los reportes del backend).
 */
const ZONA = 'America/Lima';

/** Hoy en Lima: "2026-10-19" (en-CA da justo ese formato) */
export const hoyEnLima = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());

/** "2026-10-19" + 1 → "2026-10-20". Se usa el mediodía UTC para no cruzar de día */
export function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Primer día del mes: "2026-10-19" → "2026-10-01" */
export const inicioDeMes = (fecha: string) => `${fecha.slice(0, 8)}01`;

/** Días entre dos fechas, contando ambas: (19, 21) → 3 */
export const diasEntre = (desde: string, hasta: string) =>
  Math.round(
    (new Date(`${hasta}T12:00:00Z`).getTime() -
      new Date(`${desde}T12:00:00Z`).getTime()) /
      86_400_000,
  ) + 1;

/** "2026-10-19" → "19 de octubre" */
export const fechaLarga = (fecha: string) =>
  new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

/** "2026-10-19" → "19/10" */
export const fechaCorta = (fecha: string) =>
  `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
