import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TipoMovimiento,
  UnidadMedida,
} from '../generated/prisma/client';
import { aDecimal } from '../common/decimal';
import { finDelDia, inicioDelDia } from '../common/fechas';
import { PrismaService } from '../prisma/prisma.service';
import {
  FiltroKardexDto,
  FiltroMovimientosDto,
  RegistrarAjusteDto,
  RegistrarIngresoDto,
  RegistrarMermaDto,
} from './dto/inventario.dto';

const CERO = new Prisma.Decimal(0);

type Producto = Prisma.ProductoGetPayload<object>;

@Injectable()
export class InventarioService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ingreso de mercadería (lo que trae el proveedor), en UNA transacción:
   * suma el stock de cada producto, registra un movimiento ENTRADA y, si se
   * indica, actualiza el costo y el precio de venta.
   */
  async registrarIngreso(dto: RegistrarIngresoDto, usuarioId: number) {
    const ids = dto.items.map((i) => i.productoId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Hay productos repetidos en el ingreso: suma las cantidades en una sola línea',
      );
    }
    const motivo = dto.nota
      ? `Ingreso de mercadería: ${dto.nota}`
      : 'Ingreso de mercadería';

    return this.prisma.$transaction(async (tx) => {
      const productos = await tx.producto.findMany({
        where: { id: { in: ids } },
      });

      const resultado: {
        productoId: number;
        nombre: string;
        cantidad: Prisma.Decimal;
        stockAnterior: Prisma.Decimal;
        stockNuevo: Prisma.Decimal;
      }[] = [];

      for (const item of dto.items) {
        const producto = productos.find((p) => p.id === item.productoId);
        if (!producto || !producto.activo) {
          throw new BadRequestException(
            `El producto ${item.productoId} no existe o está desactivado`,
          );
        }
        this.validarCantidad(producto, item.cantidad);

        // Precios finales: los nuevos si llegan, si no los actuales
        const compra =
          item.precioCompra !== undefined
            ? aDecimal(item.precioCompra)
            : producto.precioCompra;
        const venta =
          item.precioVenta !== undefined
            ? aDecimal(item.precioVenta)
            : producto.precioVenta;
        if (venta.lt(compra)) {
          throw new BadRequestException(
            `"${producto.nombre}": el nuevo costo (S/ ${compra.toFixed(2)}) supera el precio de venta ` +
              `(S/ ${venta.toFixed(2)}). Envía también un precioVenta mayor en este ingreso`,
          );
        }

        const cantidad = aDecimal(item.cantidad);
        const actualizado = await tx.producto.update({
          where: { id: producto.id },
          data: {
            stock: { increment: cantidad },
            precioCompra: item.precioCompra !== undefined ? compra : undefined,
            precioVenta: item.precioVenta !== undefined ? venta : undefined,
          },
        });
        await tx.movimientoInventario.create({
          data: {
            productoId: producto.id,
            usuarioId,
            tipo: TipoMovimiento.ENTRADA,
            cantidad,
            motivo,
          },
        });
        resultado.push({
          productoId: producto.id,
          nombre: producto.nombre,
          cantidad,
          stockAnterior: actualizado.stock.minus(cantidad),
          stockNuevo: actualizado.stock,
        });
      }

      return { motivo, productos: resultado };
    });
  }

  /** Merma: producto vencido, roto o perdido. Sale del inventario con su motivo */
  async registrarMerma(dto: RegistrarMermaDto, usuarioId: number) {
    return this.prisma.$transaction(async (tx) => {
      const producto = await this.obtenerProducto(dto.productoId, tx);
      this.validarCantidad(producto, dto.cantidad);
      const cantidad = aDecimal(dto.cantidad);

      // Igual que en ventas: solo descuenta si alcanza (nunca stock negativo)
      const { count } = await tx.producto.updateMany({
        where: { id: producto.id, stock: { gte: cantidad } },
        data: { stock: { decrement: cantidad } },
      });
      if (count === 0) {
        const actual = await this.obtenerProducto(producto.id, tx);
        throw new BadRequestException(
          `No puedes dar de baja ${cantidad.toString()} ${producto.unidad} de "${producto.nombre}": ` +
            `solo hay ${actual.stock.toString()}`,
        );
      }

      const movimiento = await tx.movimientoInventario.create({
        data: {
          productoId: producto.id,
          usuarioId,
          tipo: TipoMovimiento.MERMA,
          cantidad: cantidad.negated(),
          motivo: dto.motivo,
        },
      });
      const final = await this.obtenerProducto(producto.id, tx);
      return {
        movimiento,
        stockAnterior: final.stock.plus(cantidad),
        stockNuevo: final.stock,
      };
    });
  }

  /**
   * Ajuste por conteo físico: se cuenta lo que hay en el anaquel y el sistema
   * registra la diferencia (sobrante + o faltante −) para que el stock coincida.
   */
  async registrarAjuste(dto: RegistrarAjusteDto, usuarioId: number) {
    return this.prisma.$transaction(async (tx) => {
      // Bloquea el producto: si alguien vende mientras se ajusta, espera.
      // Así la diferencia se calcula sobre el stock correcto.
      await tx.$queryRaw`SELECT id FROM productos WHERE id = ${dto.productoId} FOR UPDATE`;
      const producto = await this.obtenerProducto(dto.productoId, tx);
      this.validarCantidad(producto, dto.stockReal);

      const stockReal = aDecimal(dto.stockReal);
      const diferencia = stockReal.minus(producto.stock);
      if (diferencia.isZero()) {
        throw new BadRequestException(
          `El stock de "${producto.nombre}" ya es ${producto.stock.toString()}: no hay nada que ajustar`,
        );
      }

      await tx.producto.update({
        where: { id: producto.id },
        data: { stock: stockReal },
      });
      const movimiento = await tx.movimientoInventario.create({
        data: {
          productoId: producto.id,
          usuarioId,
          tipo: TipoMovimiento.AJUSTE,
          cantidad: diferencia,
          motivo: `Conteo físico: ${dto.motivo}`,
        },
      });
      return {
        movimiento,
        stockAnterior: producto.stock,
        stockNuevo: stockReal,
        diferencia,
        resultado: diferencia.gt(0) ? 'SOBRANTE' : 'FALTANTE',
      };
    });
  }

  /**
   * Kardex de un producto: todos sus movimientos en orden, con entradas,
   * salidas y saldo acumulado. Con filtro de fechas, arranca desde el
   * saldo que había antes del periodo.
   */
  async kardex(productoId: number, filtro: FiltroKardexDto) {
    const producto = await this.obtenerProducto(productoId);
    const desde = filtro.desde ? inicioDelDia(filtro.desde) : undefined;
    const hasta = filtro.hasta ? finDelDia(filtro.hasta) : undefined;

    const anterior = desde
      ? await this.prisma.movimientoInventario.aggregate({
          where: { productoId, fecha: { lt: desde } },
          _sum: { cantidad: true },
        })
      : null;
    const saldoInicial = anterior?._sum.cantidad ?? CERO;

    const movimientos = await this.prisma.movimientoInventario.findMany({
      where: { productoId, fecha: { gte: desde, lte: hasta } },
      include: { usuario: { select: { id: true, nombre: true } } },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    });

    let saldo = saldoInicial;
    const filas = movimientos.map((m) => {
      saldo = saldo.plus(m.cantidad);
      return {
        id: m.id,
        fecha: m.fecha,
        tipo: m.tipo,
        motivo: m.motivo,
        ventaId: m.ventaId,
        usuario: m.usuario,
        entrada: m.cantidad.gt(0) ? m.cantidad : CERO,
        salida: m.cantidad.lt(0) ? m.cantidad.abs() : CERO,
        saldo,
      };
    });

    // Control de integridad: la suma de TODOS los movimientos debe ser igual al stock
    const total = await this.prisma.movimientoInventario.aggregate({
      where: { productoId },
      _sum: { cantidad: true },
    });
    const stockSegunMovimientos = total._sum.cantidad ?? CERO;

    return {
      producto: {
        id: producto.id,
        nombre: producto.nombre,
        unidad: producto.unidad,
        stockActual: producto.stock,
      },
      saldoInicial,
      movimientos: filas,
      saldoFinal: saldo,
      cuadra: stockSegunMovimientos.equals(producto.stock),
    };
  }

  /** Listado general de movimientos (para auditar mermas, ajustes, etc.) */
  async listarMovimientos(filtro: FiltroMovimientosDto) {
    const where: Prisma.MovimientoInventarioWhereInput = {
      tipo: filtro.tipo,
      productoId: filtro.productoId,
      fecha: {
        gte: filtro.desde ? inicioDelDia(filtro.desde) : undefined,
        lte: filtro.hasta ? finDelDia(filtro.hasta) : undefined,
      },
    };
    const [total, datos] = await this.prisma.$transaction([
      this.prisma.movimientoInventario.count({ where }),
      this.prisma.movimientoInventario.findMany({
        where,
        include: {
          producto: { select: { id: true, nombre: true, unidad: true } },
          usuario: { select: { id: true, nombre: true } },
        },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        skip: (filtro.pagina - 1) * filtro.limite,
        take: filtro.limite,
      }),
    ]);
    return { datos, total, pagina: filtro.pagina, limite: filtro.limite };
  }

  // ---------------- Apoyo ----------------

  private async obtenerProducto(
    id: number,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const producto = await db.producto.findUnique({ where: { id } });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  /** Productos por unidad (UND) solo aceptan cantidades enteras */
  private validarCantidad(producto: Producto, cantidad: number) {
    if (producto.unidad === UnidadMedida.UND && !Number.isInteger(cantidad)) {
      throw new BadRequestException(
        `"${producto.nombre}" se maneja por unidad: la cantidad debe ser entera`,
      );
    }
  }
}
