import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('Falta JWT_SECRET en el archivo .env');
        }
        // El token dura un turno de trabajo (por defecto 8 horas)
        const horas = Number(config.get<string>('JWT_HORAS') ?? 8);
        return { secret, signOptions: { expiresIn: horas * 3600 } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Orden importa: primero se valida el token, luego el rol
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
