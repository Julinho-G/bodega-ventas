import { IsNumber, Min } from 'class-validator';

export class AbrirTurnoDto {
  /** Sencillo con el que empieza la caja (monedas y billetes para dar vuelto) */
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'montoInicial debe ser un número con máximo 2 decimales' },
  )
  @Min(0)
  montoInicial!: number;
}

export class CerrarTurnoDto {
  /** Efectivo que el cajero contó físicamente al cerrar */
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'montoContado debe ser un número con máximo 2 decimales' },
  )
  @Min(0)
  montoContado!: number;
}
