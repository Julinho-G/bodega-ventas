import { Module } from '@nestjs/common';
import { CajaModule } from '../caja/caja.module';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';

@Module({
  imports: [CajaModule],
  controllers: [VentasController],
  providers: [VentasService],
  exports: [VentasService], // Clientes lo usará para calcular deudas
})
export class VentasModule {}
