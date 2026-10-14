import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global: PrismaService queda disponible en toda la app sin reimportar el módulo
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
