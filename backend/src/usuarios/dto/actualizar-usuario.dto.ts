import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Rol } from '../../generated/prisma/client';

/** Todos los campos son opcionales: solo se cambia lo que se envía */
export class ActualizarUsuarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password?: string;

  @IsOptional()
  @IsEnum(Rol, { message: 'El rol debe ser ADMIN o CAJERO' })
  rol?: Rol;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
