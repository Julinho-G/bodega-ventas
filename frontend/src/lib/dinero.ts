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
