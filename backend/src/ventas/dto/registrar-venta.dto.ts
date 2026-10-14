import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';
import { MetodoPago } from '../../generated/prisma/client';

export class ItemVentaDto {
  @IsInt()
  productoId!: number;

  /** Unidades (UND) o kilos/litros con hasta 3 decimales (KG, LT) */
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive({ message: 'La cantidad debe ser mayor que 0' })
  cantidad!: number;
}

export class RegistrarVentaDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'La venta debe tener al menos un producto' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ItemVentaDto)
  items!: ItemVentaDto[];

  @IsEnum(MetodoPago, {
    message: 'metodoPago debe ser EFECTIVO, YAPE, PLIN, TARJETA o FIADO',
  })
  metodoPago!: MetodoPago;

  /** Obligatorio si el método es FIADO; opcional en los demás */
  @IsOptional()
  @IsInt()
  clienteId?: number;

  /** Solo para EFECTIVO: con cuánto paga el cliente, para calcular el vuelto */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoRecibido?: number;
}
