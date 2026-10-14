import { Module } from '@nestjs/common';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';

@Module({
  controllers: [CajaController],
  providers: [CajaService],
  exports: [CajaService], // Ventas lo usa para verificar el turno abierto
})
export class CajaModule {}
