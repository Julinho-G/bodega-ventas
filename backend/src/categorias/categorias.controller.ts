import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Rol } from '../generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CategoriasService } from './categorias.service';
import { CategoriaDto } from './dto/categoria.dto';

@ApiTags('Categorías')
@ApiBearerAuth()
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categorias: CategoriasService) {}

  /** GET /api/categorias  (cualquier usuario autenticado) */
  @ApiOperation({ summary: 'Listar categorías' })
  @Get()
  listar() {
    return this.categorias.listar();
  }

  /** POST /api/categorias  (solo ADMIN) */
  @ApiOperation({ summary: 'Crear una categoría · solo ADMIN' })
  @Roles(Rol.ADMIN)
  @Post()
  crear(@Body() dto: CategoriaDto) {
    return this.categorias.crear(dto);
  }

  /** PATCH /api/categorias/:id  (solo ADMIN) */
  @ApiOperation({ summary: 'Renombrar una categoría · solo ADMIN' })
  @Roles(Rol.ADMIN)
  @Patch(':id')
  renombrar(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoriaDto) {
    return this.categorias.renombrar(id, dto);
  }

  /** DELETE /api/categorias/:id  (solo ADMIN, y solo si está vacía) */
  @ApiOperation({
    summary: 'Eliminar una categoría (solo si no tiene productos) · solo ADMIN',
  })
  @Roles(Rol.ADMIN)
  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.categorias.eliminar(id);
  }
}
