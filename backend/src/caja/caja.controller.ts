import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Rol } from '../generated/prisma/client';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { CajaService } from './caja.service';
import { AbrirTurnoDto, CerrarTurnoDto } from './dto/caja.dto';

@Controller('caja')
export class CajaController {
  constructor(private readonly caja: CajaService) {}

  /** POST /api/caja/abrir  { montoInicial } */
  @Post('abrir')
  abrir(
    @Body() dto: AbrirTurnoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.caja.abrir(usuario.id, dto.montoInicial);
  }

  /** GET /api/caja/actual  → mi turno abierto + resumen en vivo */
  @Get('actual')
  actual(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.caja.actual(usuario.id);
  }

  /** POST /api/caja/cerrar  { montoContado } → cuadre de caja */
  @Post('cerrar')
  @HttpCode(200)
  cerrar(
    @Body() dto: CerrarTurnoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.caja.cerrar(usuario.id, dto.montoContado);
  }

  /** GET /api/caja/turnos  → historial de turnos (solo ADMIN) */
  @Roles(Rol.ADMIN)
  @Get('turnos')
  listarTurnos() {
    return this.caja.listarTurnos();
  }

  /** GET /api/caja/turnos/:id  → detalle y cuadre de un turno */
  @Get('turnos/:id')
  detalleTurno(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.caja.detalleTurno(id, usuario);
  }
}
