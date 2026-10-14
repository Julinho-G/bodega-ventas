import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Rol } from '../../generated/prisma/client';

export class CrearUsuarioDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  nombre!: string;

  // Se guarda en minúsculas y sin espacios: "Maria" y "maria" son el mismo usuario
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9._]{3,30}$/, {
    message:
      'El usuario debe tener de 3 a 30 caracteres: letras, números, punto o guion bajo',
  })
  usuario!: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password!: string;

  @IsOptional()
  @IsEnum(Rol, { message: 'El rol debe ser ADMIN o CAJERO' })
  rol?: Rol;
}
