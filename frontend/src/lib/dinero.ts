/**
 * El backend envía los montos como texto ("12.5") para no perder precisión.
 * Aquí solo se convierten para MOSTRARLOS; los cálculos se hacen en el backend.
 */
const formato = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "12.5" → "S/ 12.50" */
export function soles(monto: string | number): string {
  return `S/ ${formato.format(Number(monto))}`;
}

/**
 * Lee lo que el usuario escribe ("50", "12,5", "12.50") y devuelve un número,
 * o null si no es un monto válido (negativo o con más de 2 decimales).
 */
export function leerMonto(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  return Number(limpio);
}

/**
 * Cálculos SOLO para mostrar el total mientras se arma la venta.
 * Se trabaja en céntimos (enteros) para evitar errores como 0.1 + 0.2 = 0.30000000000000004.
 * El total oficial lo calcula el backend con Decimal al registrar la venta.
 */
export function aCentimos(monto: string | number): number {
  return Math.round(Number(monto) * 100);
}

/** precio × cantidad redondeado a céntimos, igual que el backend (ROUND_HALF_UP) */
export function subtotalCentimos(precio: string, cantidad: number): number {
  const milesimas = Math.round(cantidad * 1000); // cantidades con hasta 3 decimales
  return Math.round((aCentimos(precio) * milesimas) / 1000);
}

export const solesDeCentimos = (centimos: number) => soles(centimos / 100);

/**
 * Lee una cantidad escrita por el cajero.
 * UND: solo enteros (2, 10). KG y LT: hasta 3 decimales (0.25, 1,5).
 */
export function leerCantidad(
  texto: string,
  unidad: 'UND' | 'KG' | 'LT',
): number | null {
  const limpio = texto.trim().replace(',', '.');
  const patron = unidad === 'UND' ? /^\d+$/ : /^\d+(\.\d{1,3})?$/;
  if (!patron.test(limpio)) return null;
  const valor = Number(limpio);
  return valor > 0 ? valor : null;
}
