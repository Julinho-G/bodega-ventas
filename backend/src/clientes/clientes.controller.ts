import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { ClientesService } from './clientes.service';
import {
  ActualizarClienteDto,
  CrearClienteDto,
  FiltroClientesDto,
  RegistrarPagoDto,
} from './dto/cliente.dto';

/**
 * Cualquier usuario puede registrar clientes y cobrar fiados.
 * Solo el ADMIN puede fijar el límite de crédito (se valida en el servicio).
 */
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  /** GET /api/clientes?buscar=&soloDeudores=true */
  @Get()
  listar(@Query() filtro: FiltroClientesDto) {
    return this.clientes.listar(filtro);
  }

  /** GET /api/clientes/:id  → con deuda y crédito disponible */
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.clientes.obtener(id);
  }

  /** GET /api/clientes/:id/estado-cuenta  → fiados y pagos con saldo */
  @Get(':id/estado-cuenta')
  estadoCuenta(@Param('id', ParseIntPipe) id: number) {
    return this.clientes.estadoCuenta(id);
  }

  /** POST /api/clientes */
  @Post()
  crear(
    @Body() dto: CrearClienteDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.clientes.crear(dto, usuario);
  }

  /** PATCH /api/clientes/:id */
  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarClienteDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.clientes.actualizar(id, dto, usuario);
  }

  /** POST /api/clientes/:id/pagos  { monto }  (requiere caja abierta) */
  @Post(':id/pagos')
  registrarPago(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarPagoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.clientes.registrarPago(id, dto, usuario);
  }
}
