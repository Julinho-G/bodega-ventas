import { Prisma } from '../generated/prisma/client';

/**
 * Convierte un número recibido en JSON a Decimal de Prisma.
 * Se pasa por String para no arrastrar errores de punto flotante
 * (ej. 0.1 + 0.2 = 0.30000000000000004 en JavaScript).
 */
export function aDecimal(valor: number): Prisma.Decimal {
  return new Prisma.Decimal(String(valor));
}
