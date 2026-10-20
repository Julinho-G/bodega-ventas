import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import type { UsuarioAutenticado } from './auth.types';
import { Public } from './decorators/public.decorator';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import { LoginDto } from './dto/login.dto';

@ApiTags('Acceso')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/login  →  { accessToken, usuario } */
  @ApiOperation({ summary: 'Iniciar sesión y obtener el token' })
  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** GET /api/auth/perfil  →  datos del usuario dueño del token */
  @ApiOperation({ summary: 'Datos del usuario dueño del token' })
  @ApiBearerAuth()
  @Get('perfil')
  perfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return usuario;
  }
}
