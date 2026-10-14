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
import { Rol } from '../generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CategoriasService } from './categorias.service';
import { CategoriaDto } from './dto/categoria.dto';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categorias: CategoriasService) {}

  /** GET /api/categorias  (cualquier usuario autenticado) */
  @Get()
  listar() {
    return this.categorias.listar();
  }

  /** POST /api/categorias  (solo ADMIN) */
  @Roles(Rol.ADMIN)
  @Post()
  crear(@Body() dto: CategoriaDto) {
    return this.categorias.crear(dto);
  }

  /** PATCH /api/categorias/:id  (solo ADMIN) */
  @Roles(Rol.ADMIN)
  @Patch(':id')
  renombrar(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoriaDto) {
    return this.categorias.renombrar(id, dto);
  }

  /** DELETE /api/categorias/:id  (solo ADMIN, y solo si está vacía) */
  @Roles(Rol.ADMIN)
  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.categorias.eliminar(id);
  }
}
