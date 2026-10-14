import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Rol } from '../generated/prisma/client';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import {
  FiltroKardexDto,
  FiltroMovimientosDto,
  RegistrarAjusteDto,
  RegistrarIngresoDto,
  RegistrarMermaDto,
} from './dto/inventario.dto';
import { InventarioService } from './inventario.service';

/**
 * Cambios de inventario: solo el ADMIN (dueño).
 * El kardex de un producto lo puede consultar cualquier usuario.
 */
@Controller('inventario')
export class InventarioController {
  constructor(private readonly inventario: InventarioService) {}

  /** POST /api/inventario/ingresos  → llegó mercadería del proveedor */
  @Roles(Rol.ADMIN)
  @Post('ingresos')
  registrarIngreso(
    @Body() dto: RegistrarIngresoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.inventario.registrarIngreso(dto, usuario.id);
  }

  /** POST /api/inventario/mermas  → vencido, roto, perdido */
  @Roles(Rol.ADMIN)
  @Post('mermas')
  registrarMerma(
    @Body() dto: RegistrarMermaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.inventario.registrarMerma(dto, usuario.id);
  }

  /** POST /api/inventario/ajustes  → corregir el stock tras contar el anaquel */
  @Roles(Rol.ADMIN)
  @Post('ajustes')
  registrarAjuste(
    @Body() dto: RegistrarAjusteDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.inventario.registrarAjuste(dto, usuario.id);
  }

  /** GET /api/inventario/kardex/:productoId?desde=&hasta= */
  @Get('kardex/:productoId')
  kardex(
    @Param('productoId', ParseIntPipe) productoId: number,
    @Query() filtro: FiltroKardexDto,
  ) {
    return this.inventario.kardex(productoId, filtro);
  }

  /** GET /api/inventario/movimientos?tipo=&productoId=&desde=&hasta=  (solo ADMIN) */
  @Roles(Rol.ADMIN)
  @Get('movimientos')
  listarMovimientos(@Query() filtro: FiltroMovimientosDto) {
    return this.inventario.listarMovimientos(filtro);
  }
}
