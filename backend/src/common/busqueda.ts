/**
 * Búsqueda de texto tolerante: sin importar mayúsculas ni tildes.
 * Usa la extensión unaccent de PostgreSQL (migración "busqueda_sin_tildes").
 */

/**
 * Convierte lo que escribe el usuario en un patrón "contiene" para ILIKE.
 * Escapa los comodines % y _ para que se busquen como texto normal.
 */
export function patronContiene(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
