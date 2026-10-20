import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Rol } from '../generated/prisma/client';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { UsuariosService } from './usuarios.service';

/** Gestión de usuarios: solo el ADMIN puede entrar a estas rutas */
@ApiTags('Usuarios')
@ApiBearerAuth()
@Roles(Rol.ADMIN)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  /** GET /api/usuarios */
  @ApiOperation({ summary: 'Listar usuarios · solo ADMIN' })
  @Get()
  listar() {
    return this.usuarios.listar();
  }

  /** POST /api/usuarios  (crea un cajero por defecto) */
  @ApiOperation({
    summary: 'Crear un usuario (cajero por defecto) · solo ADMIN',
  })
  @Post()
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuarios.crear(dto);
  }

  /** PATCH /api/usuarios/:id  (cambiar nombre, rol, contraseña o activar/desactivar) */
  @ApiOperation({
    summary:
      'Cambiar nombre, rol, contraseña o activar/desactivar · solo ADMIN',
  })
  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
    @UsuarioActual() quienEdita: UsuarioAutenticado,
  ) {
    return this.usuarios.actualizar(id, dto, quienEdita.id);
  }
}
