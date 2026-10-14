import { Transform } from 'class-transformer';
import {
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
} from 'class-validator';
import { UnidadMedida } from '../../generated/prisma/client';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearProductoDto {
  /** Opcional: pan, verduras o productos a granel no suelen tener código */
  @IsOptional()
  @Transform(recortar)
  @Matches(/^\d{4,14}$/, {
    message: 'El código de barras debe tener entre 4 y 14 dígitos',
  })
  codigoBarras?: string;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del producto es obligatorio' })
  @MaxLength(120)
  nombre!: string;

  @IsInt({ message: 'categoriaId debe ser un número entero' })
  categoriaId!: number;

  @IsOptional()
  @IsEnum(UnidadMedida, { message: 'La unidad debe ser UND, KG o LT' })
  unidad?: UnidadMedida;

  // Precios en soles con máximo 2 decimales
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'precioCompra debe ser un número con máximo 2 decimales' },
  )
  @Min(0)
  precioCompra!: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'precioVenta debe ser un número con máximo 2 decimales' },
  )
  @IsPositive({ message: 'precioVenta debe ser mayor que 0' })
  precioVenta!: number;

  // Cantidades con hasta 3 decimales (ej. 0.250 kg)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockInicial?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockMinimo?: number;
}
