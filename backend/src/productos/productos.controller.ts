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
import { Rol } from '../generated/prisma/client';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { FiltroProductosDto } from './dto/filtro-productos.dto';
import { ProductosService } from './productos.service';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  /** GET /api/productos?buscar=&categoriaId=&incluirInactivos=&pagina=&limite= */
  @Get()
  listar(@Query() filtro: FiltroProductosDto) {
    return this.productos.listar(filtro);
  }

  /** GET /api/productos/stock-bajo  → productos para reponer */
  @Get('stock-bajo')
  stockBajo() {
    return this.productos.stockBajo();
  }

  /** GET /api/productos/codigo/7750243001234  → lo usa el lector de la caja */
  @Get('codigo/:codigo')
  buscarPorCodigo(@Param('codigo') codigo: string) {
    return this.productos.buscarPorCodigo(codigo);
  }

  /** GET /api/productos/:id */
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.productos.obtener(id);
  }

  /** POST /api/productos  (solo ADMIN) */
  @Roles(Rol.ADMIN)
  @Post()
  crear(
    @Body() dto: CrearProductoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.productos.crear(dto, usuario.id);
  }

  /** PATCH /api/productos/:id  (solo ADMIN; el stock NO se edita aquí) */
  @Roles(Rol.ADMIN)
  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProductoDto,
  ) {
    return this.productos.actualizar(id, dto);
  }
}
