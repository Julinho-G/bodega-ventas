import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { CategoriasModule } from './categorias/categorias.module';
import { ProductosModule } from './productos/productos.module';
import { CajaModule } from './caja/caja.module';
import { VentasModule } from './ventas/ventas.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // lee el archivo .env
    PrismaModule,
    AuthModule, // protege TODAS las rutas con JWT (salvo las marcadas con @Public)
    UsuariosModule,
    CategoriasModule,
    ProductosModule,
    CajaModule,
    VentasModule,
    // Próximos: ClientesModule (fiado), InventarioModule, ReportesModule...
  ],
  controllers: [HealthController],
})
export class AppModule {}
