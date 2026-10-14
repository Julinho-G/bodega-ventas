import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Valida usuario y contraseña. Si son correctos devuelve el token JWT
   * y los datos básicos del usuario (nunca el hash de la contraseña).
   */
  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { usuario: dto.usuario.trim().toLowerCase() },
    });

    // Mismo mensaje para "no existe" y "contraseña mala": no damos pistas a un atacante
    const credencialesValidas =
      usuario && (await bcrypt.compare(dto.password, usuario.passwordHash));
    if (!usuario || !credencialesValidas) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }
    if (!usuario.activo) {
      throw new UnauthorizedException('Tu usuario está desactivado');
    }

    const payload: JwtPayload = {
      sub: usuario.id,
      usuario: usuario.usuario,
      rol: usuario.rol,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        usuario: usuario.usuario,
        rol: usuario.rol,
      },
    };
  }
}
