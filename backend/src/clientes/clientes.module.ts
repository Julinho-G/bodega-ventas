import { Module } from '@nestjs/common';
import { CajaModule } from '../caja/caja.module';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

@Module({
  imports: [CajaModule], // cobrar un fiado exige caja abierta
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService], // Ventas lo usa para el crédito al fiado
})
export class ClientesModule {}
