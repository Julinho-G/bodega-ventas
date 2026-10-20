import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Rol } from '../generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { FiltroProductosVendidosDto, PeriodoDto } from './dto/reportes.dto';
import { ReportesService } from './reportes.service';

/** Reportes del negocio: solo el dueño (ADMIN). Fechas en hora de Lima */
@ApiTags('Reportes')
@ApiBearerAuth()
@Roles(Rol.ADMIN)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  /** GET /api/reportes/resumen?desde=AAAA-MM-DD&hasta=AAAA-MM-DD  (sin fechas = hoy) */
  @ApiOperation({
    summary:
      'Resumen del periodo: vendido, ganancia, métodos de pago y ventas por hora y día · solo ADMIN',
  })
  @Get('resumen')
  resumen(@Query() periodo: PeriodoDto) {
    return this.reportes.resumen(periodo);
  }

  /** GET /api/reportes/productos?desde=&hasta=&orden=cantidad|importe|ganancia&limite=10 */
  @ApiOperation({
    summary:
      'Ranking de productos por cantidad, importe o ganancia · solo ADMIN',
  })
  @Get('productos')
  productosVendidos(@Query() filtro: FiltroProductosVendidosDto) {
    return this.reportes.productosVendidos(filtro);
  }

  /** GET /api/reportes/inventario  → valor de la mercadería al costo y a precio de venta */
  @ApiOperation({
    summary: 'Valor de la mercadería al costo y a precio de venta · solo ADMIN',
  })
  @Get('inventario')
  inventarioValorizado() {
    return this.reportes.inventarioValorizado();
  }
}
