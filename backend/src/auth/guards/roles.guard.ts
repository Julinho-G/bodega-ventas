import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Rol } from '../../generated/prisma/client';
import { UsuarioAutenticado } from '../auth.types';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard GLOBAL que se ejecuta después de JwtAuthGuard.
 * Si la ruta tiene @Roles(...), verifica que el usuario tenga uno de esos roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rolesPermitidos || rolesPermitidos.length === 0) return true;

    const { usuario } = context
      .switchToHttp()
      .getRequest<Request & { usuario?: UsuarioAutenticado }>();

    if (!usuario || !rolesPermitidos.includes(usuario.rol)) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    return true;
  }
}
