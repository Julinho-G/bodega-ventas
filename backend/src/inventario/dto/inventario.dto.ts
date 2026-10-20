import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TipoMovimiento } from '../../generated/prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// ---------------- Ingreso de mercadería ----------------

export class ItemIngresoDto {
  @IsInt()
  productoId!: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive({ message: 'La cantidad debe ser mayor que 0' })
  // IsPositive se documentaría como «mínimo 1»; se aclara que basta con ser mayor que 0 (ej. 0.25 kg)
  @ApiProperty({ minimum: 0, exclusiveMinimum: true })
  cantidad!: number;

  /** Nuevo costo unitario según la factura del proveedor (opcional) */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioCompra?: number;

  /** Nuevo precio de venta, por si el costo subió (opcional) */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  // IsPositive se documentaría como «mínimo 1»; se aclara que basta con ser mayor que 0 (ej. 0.25 kg)
  @ApiPropertyOptional({ minimum: 0, exclusiveMinimum: true })
  precioVenta?: number;
}

export class RegistrarIngresoDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'El ingreso debe tener al menos un producto' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ItemIngresoDto)
  items!: ItemIngresoDto[];

  /** Proveedor, número de factura o boleta, etc. */
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(150)
  nota?: string;
}

// ---------------- Merma ----------------

export class RegistrarMermaDto {
  @IsInt()
  productoId!: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive({ message: 'La cantidad debe ser mayor que 0' })
  // IsPositive se documentaría como «mínimo 1»; se aclara que basta con ser mayor que 0 (ej. 0.25 kg)
  @ApiProperty({ minimum: 0, exclusiveMinimum: true })
  cantidad!: number;

  /** Ej.: "Vencido", "Botella rota", "Roedores" */
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Indica el motivo de la merma' })
  @MaxLength(150)
  motivo!: string;
}

// ---------------- Ajuste por conteo físico ----------------

export class RegistrarAjusteDto {
  @IsInt()
  productoId!: number;

  /** Lo que realmente hay en el anaquel después de contar */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockReal!: number;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Indica el motivo del ajuste' })
  @MaxLength(150)
  motivo!: string;
}

// ---------------- Consultas ----------------

/** GET /api/inventario/kardex/:productoId?desde=2026-10-01&hasta=2026-10-31 */
export class FiltroKardexDto {
  @IsOptional()
  @Matches(FECHA, { message: 'desde debe tener el formato AAAA-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA, { message: 'hasta debe tener el formato AAAA-MM-DD' })
  hasta?: string;
}

/** GET /api/inventario/movimientos?tipo=MERMA&desde=&hasta=&pagina=&limite= */
export class FiltroMovimientosDto extends FiltroKardexDto {
  @IsOptional()
  @IsEnum(TipoMovimiento, {
    message: 'tipo debe ser ENTRADA, VENTA, AJUSTE o MERMA',
  })
  tipo?: TipoMovimiento;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productoId?: number;

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
