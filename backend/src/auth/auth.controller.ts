import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { UsuarioAutenticado } from './auth.types';
import { Public } from './decorators/public.decorator';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/login  →  { accessToken, usuario } */
  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** GET /api/auth/perfil  →  datos del usuario dueño del token */
  @Get('perfil')
  perfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return usuario;
  }
}
