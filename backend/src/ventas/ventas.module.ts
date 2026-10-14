import { Module } from '@nestjs/common';
import { CajaModule } from '../caja/caja.module';
import { ClientesModule } from '../clientes/clientes.module';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';

@Module({
  imports: [CajaModule, ClientesModule],
  controllers: [VentasController],
  providers: [VentasService],
})
export class VentasModule {}
