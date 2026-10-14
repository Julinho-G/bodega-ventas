import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { UnidadMedida } from '../../generated/prisma/client';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Todos los campos son opcionales.
 * NO incluye "stock": el stock solo cambia mediante movimientos de inventario
 * (ventas, ingresos de mercadería, ajustes, mermas). Si se envía, la API responde 400.
 */
export class ActualizarProductoDto {
  /** Enviar null para quitar el código de barras */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(recortar)
  @Matches(/^\d{4,14}$/, {
    message: 'El código de barras debe tener entre 4 y 14 dígitos',
  })
  codigoBarras?: string | null;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsInt()
  categoriaId?: number;

  @IsOptional()
  @IsEnum(UnidadMedida, { message: 'La unidad debe ser UND, KG o LT' })
  unidad?: UnidadMedida;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioCompra?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'precioVenta debe ser mayor que 0' })
  precioVenta?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockMinimo?: number;

  /** false = producto descontinuado (no se borra para conservar el historial de ventas) */
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
