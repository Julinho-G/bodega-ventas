import { SetMetadata } from '@nestjs/common';
import { Rol } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restringe una ruta (o un controlador entero) a ciertos roles.
 * Ejemplo:  @Roles(Rol.ADMIN)
 * Si no se usa, cualquier usuario autenticado puede entrar.
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
