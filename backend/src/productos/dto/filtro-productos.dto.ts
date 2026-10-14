import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// En la URL todo llega como texto: "true" → true
const aBooleano = ({ value }: { value: unknown }) =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : value;

/** Parámetros de búsqueda:  GET /api/productos?buscar=arroz&categoriaId=1&pagina=1 */
export class FiltroProductosDto {
  /** Busca por nombre (parcial, sin importar mayúsculas) o por código de barras */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  buscar?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoriaId?: number;

  /** Por defecto solo activos. Enviar incluirInactivos=true para ver todos */
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  incluirInactivos?: boolean;

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
