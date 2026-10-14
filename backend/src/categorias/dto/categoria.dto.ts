import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Sirve para crear y para renombrar una categoría */
export class CategoriaDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la categoría es obligatorio' })
  @MaxLength(60)
  nombre!: string;
}
