import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UsuarioAutenticado } from '../auth.types';

/**
 * Inyecta el usuario que hizo la petición en un parámetro del controlador.
 * Ejemplo:  perfil(@UsuarioActual() usuario: UsuarioAutenticado)
 */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { usuario: UsuarioAutenticado }>();
    return request.usuario;
  },
);
