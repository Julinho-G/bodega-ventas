import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, UsuarioAutenticado } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard GLOBAL: se ejecuta antes de cada ruta.
 * 1. Si la ruta tiene @Public(), deja pasar.
 * 2. Si no, exige el encabezado  Authorization: Bearer <token>
 * 3. Verifica el token y que el usuario siga existiendo y activo.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublica) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { usuario?: UsuarioAutenticado }>();

    const token = this.extraerToken(request);
    if (!token) throw new UnauthorizedException('Debes iniciar sesión');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    // Se consulta la BD para que un usuario desactivado pierda acceso de inmediato
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        nombre: true,
        usuario: true,
        rol: true,
        activo: true,
      },
    });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no autorizado');
    }

    request.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      usuario: usuario.usuario,
      rol: usuario.rol,
    };
    return true;
  }

  private extraerToken(request: Request): string | undefined {
    const [tipo, token] = request.headers.authorization?.split(' ') ?? [];
    return tipo === 'Bearer' ? token : undefined;
  }
}
