import { Module } from '@nestjs/common';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';

@Module({
  controllers: [ProductosController],
  providers: [ProductosService],
  exports: [ProductosService], // lo usarán Ventas e Inventario
})
export class ProductosModule {}
