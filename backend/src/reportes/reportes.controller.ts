import { Controller, Get, Query } from '@nestjs/common';
import { Rol } from '../generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { FiltroProductosVendidosDto, PeriodoDto } from './dto/reportes.dto';
import { ReportesService } from './reportes.service';

/** Reportes del negocio: solo el dueño (ADMIN). Fechas en hora de Lima */
@Roles(Rol.ADMIN)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  /** GET /api/reportes/resumen?desde=AAAA-MM-DD&hasta=AAAA-MM-DD  (sin fechas = hoy) */
  @Get('resumen')
  resumen(@Query() periodo: PeriodoDto) {
    return this.reportes.resumen(periodo);
  }

  /** GET /api/reportes/productos?desde=&hasta=&orden=cantidad|importe|ganancia&limite=10 */
  @Get('productos')
  productosVendidos(@Query() filtro: FiltroProductosVendidosDto) {
    return this.reportes.productosVendidos(filtro);
  }

  /** GET /api/reportes/inventario  → valor de la mercadería al costo y a precio de venta */
  @Get('inventario')
  inventarioValorizado() {
    return this.reportes.inventarioValorizado();
  }
}
