import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// En la URL todo llega como texto: "true" → true
const aBooleano = ({ value }: { value: unknown }) =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : value;

export class CrearClienteDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del cliente es obligatorio' })
  @MaxLength(100)
  nombre!: string;

  @IsOptional()
  @Transform(recortar)
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener 8 dígitos' })
  dni?: string;

  /** Celular peruano: 9 dígitos que empiezan con 9 */
  @IsOptional()
  @Transform(recortar)
  @Matches(/^9\d{8}$/, {
    message: 'El teléfono debe ser un celular de 9 dígitos que empiece con 9',
  })
  telefono?: string;

  /** Cuánto se le puede fiar como máximo. Solo el ADMIN puede fijarlo */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  limiteCredito?: number;
}

/** Todos los campos opcionales. Enviar null en dni o telefono para borrarlos */
export class ActualizarClienteDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(recortar)
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener 8 dígitos' })
  dni?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(recortar)
  @Matches(/^9\d{8}$/, {
    message: 'El teléfono debe ser un celular de 9 dígitos que empiece con 9',
  })
  telefono?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  limiteCredito?: number;
}

/** GET /api/clientes?buscar=rosa&soloDeudores=true */
export class FiltroClientesDto {
  /** Busca por nombre (parcial) o DNI */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  buscar?: string;

  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  soloDeudores?: boolean;
}

export class RegistrarPagoDto {
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'monto debe ser un número con máximo 2 decimales' },
  )
  @Min(0.01, { message: 'El monto debe ser mayor que 0' })
  monto!: number;
}
