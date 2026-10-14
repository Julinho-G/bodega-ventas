import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/ventas?desde=2026-10-01&hasta=2026-10-31&turnoId=3 */
export class FiltroVentasDto {
  /** Día inicial (hora de Lima), formato AAAA-MM-DD */
  @IsOptional()
  @Matches(FECHA, { message: 'desde debe tener el formato AAAA-MM-DD' })
  desde?: string;

  /** Día final, incluido completo (hasta las 23:59:59 de Lima) */
  @IsOptional()
  @Matches(FECHA, { message: 'hasta debe tener el formato AAAA-MM-DD' })
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  turnoId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite: number = 50;
}
