import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Periodo del reporte. Si no se envía, se usa el día de hoy (hora de Lima) */
export class PeriodoDto {
  @IsOptional()
  @Matches(FECHA, { message: 'desde debe tener el formato AAAA-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA, { message: 'hasta debe tener el formato AAAA-MM-DD' })
  hasta?: string;
}

export const ORDENES_PRODUCTOS = ['cantidad', 'importe', 'ganancia'] as const;
export type OrdenProductos = (typeof ORDENES_PRODUCTOS)[number];

/** GET /api/reportes/productos?desde=&hasta=&orden=ganancia&limite=10 */
export class FiltroProductosVendidosDto extends PeriodoDto {
  @IsOptional()
  @IsIn(ORDENES_PRODUCTOS, {
    message: 'orden debe ser cantidad, importe o ganancia',
  })
  orden: OrdenProductos = 'importe';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 10;
}
