import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnularVentaDto {
  /** Siempre se pide el motivo: queda registrado para auditoría */
  @IsString()
  @IsNotEmpty({ message: 'Indica el motivo de la anulación' })
  @MaxLength(200)
  motivo!: string;
}
