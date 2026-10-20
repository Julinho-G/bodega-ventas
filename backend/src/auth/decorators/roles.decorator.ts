import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { Rol } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restringe una ruta (o un controlador entero) a ciertos roles.
 * Ejemplo:  @Roles(Rol.ADMIN)
 * Si no se usa, cualquier usuario autenticado puede entrar.
 * También lo anota en la documentación (Swagger) como respuesta 403.
 */
export const Roles = (...roles: Rol[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiForbiddenResponse({
      description: `Solo para el rol ${roles.join(' o ')}`,
    }),
  );
