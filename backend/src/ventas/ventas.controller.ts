import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { AnularVentaDto } from './dto/anular-venta.dto';
import { FiltroVentasDto } from './dto/filtro-ventas.dto';
import { RegistrarVentaDto } from './dto/registrar-venta.dto';
import { VentasService } from './ventas.service';

@ApiTags('Ventas')
@ApiBearerAuth()
@Controller('ventas')
export class VentasController {
  constructor(private readonly ventas: VentasService) {}

  /** POST /api/ventas  → registra la venta (requiere caja abierta) */
  @ApiOperation({ summary: 'Registrar una venta (requiere caja abierta)' })
  @Post()
  registrar(
    @Body() dto: RegistrarVentaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.ventas.registrar(dto, usuario);
  }

  /** GET /api/ventas?desde=&hasta=&turnoId=&pagina=&limite= */
  @ApiOperation({ summary: 'Listar ventas (el cajero solo ve las suyas)' })
  @Get()
  listar(
    @Query() filtro: FiltroVentasDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.ventas.listar(filtro, usuario);
  }

  /** GET /api/ventas/:id  → venta con su detalle */
  @ApiOperation({ summary: 'Venta con su detalle' })
  @Get(':id')
  obtener(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.ventas.obtener(id, usuario);
  }

  /** POST /api/ventas/:id/anular  { motivo } */
  @ApiOperation({ summary: 'Anular una venta con motivo (devuelve el stock)' })
  @Post(':id/anular')
  @HttpCode(200)
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularVentaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.ventas.anular(id, dto, usuario);
  }
}
