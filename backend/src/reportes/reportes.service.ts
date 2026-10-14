import { BadRequestException, Injectable } from '@nestjs/common';
import { MetodoPago, Prisma } from '../generated/prisma/client';
import { hoyEnLima } from '../common/fechas';
import { PrismaService } from '../prisma/prisma.service';
import {
  FiltroProductosVendidosDto,
  OrdenProductos,
  PeriodoDto,
} from './dto/reportes.dto';

/** Convierte lo que devuelve SQL (texto o null) a Decimal. Las sumas se piden como ::text */
const dec = (valor: string | null | undefined) =>
  new Prisma.Decimal(valor ?? 0);

const CERO = new Prisma.Decimal(0);

/**
 * Fecha de la venta convertida a hora de Lima.
 * Las fechas se guardan en UTC: sin esta conversión, una venta de las 8 p. m.
 * aparecería en el día siguiente.
 */
const FECHA_LIMA = Prisma.sql`((v.fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')`;

// Columna por la que se ordena el ranking de productos (lista cerrada: evita inyección SQL)
const COLUMNA_ORDEN: Record<OrdenProductos, Prisma.Sql> = {
  cantidad: Prisma.sql`SUM(d.cantidad)`,
  importe: Prisma.sql`SUM(d.subtotal)`,
  ganancia: Prisma.sql`SUM(d.subtotal - ROUND(d.costo_unitario * d.cantidad, 2))`,
};

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resumen del periodo: ventas, costo, ganancia y margen, con desglose
   * por método de pago, por día y por hora (horas pico de la bodega).
   * Solo cuentan las ventas PAGADAS; las anuladas se informan aparte.
   */
  async resumen(periodo: PeriodoDto) {
    const { desde, hasta } = this.periodo(periodo);
    const enPeriodo = Prisma.sql`${FECHA_LIMA}::date BETWEEN ${desde}::date AND ${hasta}::date`;

    // Totales: el costo sale del detalle (costo congelado al vender)
    const [totales] = await this.prisma.$queryRaw<
      { ventas: number; total: string; costo: string }[]
    >`
      SELECT COUNT(*)::int AS ventas,
             COALESCE(SUM(v.total), 0)::text AS total,
             COALESCE(SUM(c.costo), 0)::text AS costo
      FROM ventas v
      JOIN (
        SELECT venta_id, SUM(ROUND(costo_unitario * cantidad, 2)) AS costo
        FROM detalle_venta GROUP BY venta_id
      ) c ON c.venta_id = v.id
      WHERE v.estado = 'PAGADA' AND ${enPeriodo}`;

    const [anuladas] = await this.prisma.$queryRaw<
      { cantidad: number; monto: string }[]
    >`
      SELECT COUNT(*)::int AS cantidad, COALESCE(SUM(v.total), 0)::text AS monto
      FROM ventas v
      WHERE v.estado = 'ANULADA' AND ${enPeriodo}`;

    const metodos = await this.prisma.$queryRaw<
      { metodo: MetodoPago; ventas: number; total: string }[]
    >`
      SELECT v.metodo_pago AS metodo, COUNT(*)::int AS ventas, SUM(v.total)::text AS total
      FROM ventas v
      WHERE v.estado = 'PAGADA' AND ${enPeriodo}
      GROUP BY v.metodo_pago`;

    const dias = await this.prisma.$queryRaw<
      { dia: string; ventas: number; total: string; costo: string }[]
    >`
      SELECT to_char(${FECHA_LIMA}, 'YYYY-MM-DD') AS dia,
             COUNT(*)::int AS ventas,
             SUM(v.total)::text AS total,
             SUM(c.costo)::text AS costo
      FROM ventas v
      JOIN (
        SELECT venta_id, SUM(ROUND(costo_unitario * cantidad, 2)) AS costo
        FROM detalle_venta GROUP BY venta_id
      ) c ON c.venta_id = v.id
      WHERE v.estado = 'PAGADA' AND ${enPeriodo}
      GROUP BY 1 ORDER BY 1`;

    const horas = await this.prisma.$queryRaw<
      { hora: number; ventas: number; total: string }[]
    >`
      SELECT EXTRACT(HOUR FROM ${FECHA_LIMA})::int AS hora,
             COUNT(*)::int AS ventas,
             SUM(v.total)::text AS total
      FROM ventas v
      WHERE v.estado = 'PAGADA' AND ${enPeriodo}
      GROUP BY 1 ORDER BY 1`;

    const total = dec(totales.total);
    const costo = dec(totales.costo);
    const ganancia = total.minus(costo);

    return {
      periodo: { desde, hasta },
      cantidadVentas: totales.ventas,
      totalVendido: total,
      costoDeVentas: costo,
      gananciaBruta: ganancia,
      margenPorcentaje: total.isZero()
        ? CERO
        : ganancia.div(total).times(100).toDecimalPlaces(2),
      ticketPromedio: totales.ventas
        ? total.div(totales.ventas).toDecimalPlaces(2)
        : CERO,
      anuladas: { cantidad: anuladas.cantidad, monto: dec(anuladas.monto) },
      // Todos los métodos aparecen, aunque tengan 0
      porMetodoPago: Object.values(MetodoPago).map((metodo) => {
        const fila = metodos.find((m) => m.metodo === metodo);
        return {
          metodo,
          ventas: fila?.ventas ?? 0,
          total: dec(fila?.total),
        };
      }),
      porDia: dias.map((d) => ({
        dia: d.dia,
        ventas: d.ventas,
        total: dec(d.total),
        ganancia: dec(d.total).minus(dec(d.costo)),
      })),
      porHora: horas.map((h) => ({
        hora: h.hora,
        ventas: h.ventas,
        total: dec(h.total),
      })),
    };
  }

  /** Ranking de productos vendidos en el periodo */
  async productosVendidos(filtro: FiltroProductosVendidosDto) {
    const { desde, hasta } = this.periodo(filtro);
    const filas = await this.prisma.$queryRaw<
      {
        id: number;
        nombre: string;
        unidad: string;
        categoria: string;
        ventas: number;
        cantidad: string;
        importe: string;
        ganancia: string;
      }[]
    >`
      SELECT p.id, p.nombre, p.unidad, c.nombre AS categoria,
             COUNT(DISTINCT v.id)::int AS ventas,
             SUM(d.cantidad)::text AS cantidad,
             SUM(d.subtotal)::text AS importe,
             SUM(d.subtotal - ROUND(d.costo_unitario * d.cantidad, 2))::text AS ganancia
      FROM detalle_venta d
      JOIN ventas v ON v.id = d.venta_id
      JOIN productos p ON p.id = d.producto_id
      JOIN categorias c ON c.id = p.categoria_id
      WHERE v.estado = 'PAGADA'
        AND ${FECHA_LIMA}::date BETWEEN ${desde}::date AND ${hasta}::date
      GROUP BY p.id, p.nombre, p.unidad, c.nombre
      ORDER BY ${COLUMNA_ORDEN[filtro.orden]} DESC, p.nombre
      LIMIT ${filtro.limite}`;

    return {
      periodo: { desde, hasta },
      orden: filtro.orden,
      productos: filas.map((f, i) => ({
        puesto: i + 1,
        ...f,
        cantidad: dec(f.cantidad),
        importe: dec(f.importe),
        ganancia: dec(f.ganancia),
      })),
    };
  }

  /**
   * Inventario valorizado (productos activos), por categoría:
   * cuánto costó la mercadería que hay y cuánto valdría vendida.
   */
  async inventarioValorizado() {
    const filas = await this.prisma.$queryRaw<
      {
        categoria: string;
        productos: number;
        stockBajo: number;
        sinStock: number;
        valorCosto: string;
        valorVenta: string;
      }[]
    >`
      SELECT c.nombre AS categoria,
             COUNT(p.id)::int AS productos,
             COUNT(p.id) FILTER (WHERE p.stock <= p.stock_minimo)::int AS "stockBajo",
             COUNT(p.id) FILTER (WHERE p.stock = 0)::int AS "sinStock",
             COALESCE(SUM(ROUND(p.stock * p.precio_compra, 2)), 0)::text AS "valorCosto",
             COALESCE(SUM(ROUND(p.stock * p.precio_venta, 2)), 0)::text AS "valorVenta"
      FROM categorias c
      JOIN productos p ON p.categoria_id = c.id AND p.activo = true
      GROUP BY c.nombre
      ORDER BY SUM(p.stock * p.precio_compra) DESC, c.nombre`;

    const categorias = filas.map((f) => {
      const valorCosto = dec(f.valorCosto);
      const valorVenta = dec(f.valorVenta);
      return {
        ...f,
        valorCosto,
        valorVenta,
        gananciaPotencial: valorVenta.minus(valorCosto),
      };
    });
    const suma = (campo: 'valorCosto' | 'valorVenta') =>
      categorias.reduce((acc, c) => acc.plus(c[campo]), CERO);

    return {
      fecha: hoyEnLima(),
      categorias,
      totales: {
        productos: categorias.reduce((acc, c) => acc + c.productos, 0),
        stockBajo: categorias.reduce((acc, c) => acc + c.stockBajo, 0),
        sinStock: categorias.reduce((acc, c) => acc + c.sinStock, 0),
        valorCosto: suma('valorCosto'),
        valorVenta: suma('valorVenta'),
        gananciaPotencial: suma('valorVenta').minus(suma('valorCosto')),
      },
    };
  }

  /** Periodo por defecto: hoy. Valida el orden y un máximo de un año */
  private periodo(p: PeriodoDto) {
    const hoy = hoyEnLima();
    const desde = p.desde ?? p.hasta ?? hoy;
    const hasta = p.hasta ?? (p.desde ? hoy : desde);
    if (desde > hasta) {
      throw new BadRequestException('"desde" no puede ser posterior a "hasta"');
    }
    const dias =
      (new Date(hasta).getTime() - new Date(desde).getTime()) / 86_400_000;
    if (dias > 366) {
      throw new BadRequestException('El periodo no puede superar un año');
    }
    return { desde, hasta };
  }
}
