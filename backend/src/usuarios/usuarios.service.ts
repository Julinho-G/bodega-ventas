import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Prisma, Rol } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';

// Campos que se pueden mostrar. El passwordHash NUNCA sale de este servicio.
const CAMPOS_PUBLICOS = {
  id: true,
  nombre: true,
  usuario: true,
  rol: true,
  activo: true,
  creadoEn: true,
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.usuario.findMany({
      select: CAMPOS_PUBLICOS,
      orderBy: { nombre: 'asc' },
    });
  }

  async crear(dto: CrearUsuarioDto) {
    const existe = await this.prisma.usuario.findUnique({
      where: { usuario: dto.usuario },
    });
    if (existe) {
      throw new ConflictException(`El usuario "${dto.usuario}" ya existe`);
    }

    return this.prisma.usuario.create({
      data: {
        nombre: dto.nombre.trim(),
        usuario: dto.usuario,
        passwordHash: await bcrypt.hash(dto.password, 10),
        rol: dto.rol ?? Rol.CAJERO,
      },
      select: CAMPOS_PUBLICOS,
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarUsuarioDto,
    idQuienEdita: number,
  ) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    // Regla: un administrador no puede quitarse a sí mismo el acceso
    if (id === idQuienEdita) {
      if (dto.activo === false) {
        throw new BadRequestException('No puedes desactivar tu propio usuario');
      }
      if (dto.rol && dto.rol !== Rol.ADMIN) {
        throw new BadRequestException(
          'No puedes quitarte el rol de administrador',
        );
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        nombre: dto.nombre?.trim(),
        rol: dto.rol,
        activo: dto.activo,
        passwordHash: dto.password
          ? await bcrypt.hash(dto.password, 10)
          : undefined,
      },
      select: CAMPOS_PUBLICOS,
    });
  }
}
