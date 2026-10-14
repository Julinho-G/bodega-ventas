import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoTurno,
  EstadoVenta,
  MetodoPago,
  Prisma,
  Rol,
  TipoMovimiento,
  UnidadMedida,
} from '../generated/prisma/client';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { CajaService } from '../caja/caja.service';
import { ClientesService } from '../clientes/clientes.service';
import { aDecimal } from '../common/decimal';
import { PrismaService } from '../prisma/prisma.service';
import { AnularVentaDto } from './dto/anular-venta.dto';
import { FiltroVentasDto } from './dto/filtro-ventas.dto';
import { RegistrarVentaDto } from './dto/registrar-venta.dto';

const CERO = new Prisma.Decimal(0);

// Lo que se devuelve de cada venta
const INCLUIR_DETALLE = {
  detalles: {
    include: {
      producto: {
        select: { id: true, nombre: true, unidad: true, codigoBarras: true },
      },
    },
    orderBy: { id: 'asc' },
  },
  cliente: { select: { id: true, nombre: true } },
  usuario: { select: { id: true, nombre: true } },
} satisfies Prisma.VentaInclude;

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caja: CajaService,
    private readonly clientes: ClientesService,
  ) {}

  /**
   * Registra una venta en UNA sola transacción:
   *   1. crea la venta y su detalle (con el precio del momento)
   *   2. descuenta el stock de cada producto
   *   3. registra un movimiento de inventario tipo VENTA por producto
   * Si cualquier paso falla (ej. falta stock), se revierte TODO.
   */
  async registrar(dto: RegistrarVentaDto, usuario: UsuarioAutenticado) {
    const ids = dto.items.map((i) => i.productoId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Hay productos repetidos en la venta: suma las cantidades en una sola línea',
      );
    }
    if (dto.metodoPago === MetodoPago.FIADO && !dto.clienteId) {
      throw new BadRequestException(
        'Para vender al fiado debes elegir un cliente',
      );
    }

    const ventaId = await this.prisma.$transaction(async (tx) => {
      const turno = await this.caja.obtenerTurnoAbierto(usuario.id, tx);

      // --- Productos y cálculo de montos ---
      const productos = await tx.producto.findMany({
        where: { id: { in: ids } },
      });
      const lineas = dto.items.map((item) => {
        const producto = productos.find((p) => p.id === item.productoId);
        if (!producto || !producto.activo) {
          throw new BadRequestException(
            `El producto ${item.productoId} no existe o está desactivado`,
          );
        }
        if (
          producto.unidad === UnidadMedida.UND &&
          !Number.isInteger(item.cantidad)
        ) {
          throw new BadRequestException(
            `"${producto.nombre}" se vende por unidad: la cantidad debe ser entera`,
          );
        }
        const cantidad = aDecimal(item.cantidad);
        // Subtotal redondeado a céntimos (ej. 0.333 kg × S/ 4.50 = 1.4985 → 1.50)
        const subtotal = producto.precioVenta
          .times(cantidad)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        return { producto, cantidad, subtotal };
      });
      const total = lineas.reduce((acc, l) => acc.plus(l.subtotal), CERO);

      // --- Validaciones de pago ---
      if (dto.clienteId) {
        const existe = await tx.cliente.findUnique({
          where: { id: dto.clienteId },
        });
        if (!existe) throw new BadRequestException('El cliente no existe');

        if (dto.metodoPago === MetodoPago.FIADO) {
          // Bloquea al cliente: si otra caja le está fiando ahora, espera su turno
          const cliente = await this.clientes.bloquear(existe.id, tx);
          const deuda = await this.clientes.deuda(cliente.id, tx);
          const disponible = cliente.limiteCredito.minus(deuda);
          if (total.gt(disponible)) {
            throw new BadRequestException(
              `Crédito insuficiente para ${cliente.nombre}: debe S/ ${deuda.toFixed(2)}, ` +
                `límite S/ ${cliente.limiteCredito.toFixed(2)}, disponible S/ ${disponible.toFixed(2)}`,
            );
          }
        }
      }
      if (dto.montoRecibido !== undefined) {
        if (dto.metodoPago !== MetodoPago.EFECTIVO) {
          throw new BadRequestException(
            'montoRecibido solo aplica a pagos en EFECTIVO',
          );
        }
        if (aDecimal(dto.montoRecibido).lt(total)) {
          throw new BadRequestException(
            `El monto recibido (S/ ${dto.montoRecibido.toFixed(2)}) no cubre el total (S/ ${total.toFixed(2)})`,
          );
        }
      }

      // --- Descontar stock de forma segura ---
      // El UPDATE solo se aplica si todavía hay stock suficiente. Así, si dos cajas
      // venden el último producto al mismo tiempo, solo una lo logra.
      for (const l of lineas) {
        const { count } = await tx.producto.updateMany({
          where: { id: l.producto.id, stock: { gte: l.cantidad } },
          data: { stock: { decrement: l.cantidad } },
        });
        if (count === 0) {
          const actual = await tx.producto.findUniqueOrThrow({
            where: { id: l.producto.id },
          });
          throw new BadRequestException(
            `Stock insuficiente de "${l.producto.nombre}": quedan ${actual.stock.toString()} ${l.producto.unidad}`,
          );
        }
      }

      // --- Venta, detalle y movimientos ---
      // Se crea por pasos (cabecera, detalle, movimientos) para que cada
      // consulta espere a la anterior dentro de la transacción
      const creada = await tx.venta.create({
        data: {
          turnoCajaId: turno.id,
          usuarioId: usuario.id,
          clienteId: dto.clienteId,
          metodoPago: dto.metodoPago,
          total,
        },
      });
      await tx.detalleVenta.createMany({
        data: lineas.map((l) => ({
          ventaId: creada.id,
          productoId: l.producto.id,
          cantidad: l.cantidad,
          precioUnitario: l.producto.precioVenta, // precio congelado
          costoUnitario: l.producto.precioCompra, // costo congelado (para la ganancia)
          subtotal: l.subtotal,
        })),
      });

      await tx.movimientoInventario.createMany({
        data: lineas.map((l) => ({
          productoId: l.producto.id,
          ventaId: creada.id,
          usuarioId: usuario.id,
          tipo: TipoMovimiento.VENTA,
          cantidad: l.cantidad.negated(), // sale del inventario
          motivo: `Venta #${creada.id}`,
        })),
      });

      return creada.id;
    });

    // Se lee la venta completa ya confirmada (fuera de la transacción)
    const venta = await this.prisma.venta.findUniqueOrThrow({
      where: { id: ventaId },
      include: INCLUIR_DETALLE,
    });
    const vuelto =
      dto.montoRecibido !== undefined
        ? aDecimal(dto.montoRecibido).minus(venta.total)
        : null;
    return { ...venta, montoRecibido: dto.montoRecibido ?? null, vuelto };
  }

  /** ADMIN ve todas las ventas; el cajero solo las suyas */
  async listar(filtro: FiltroVentasDto, usuario: UsuarioAutenticado) {
    const where: Prisma.VentaWhereInput = {
      usuarioId: usuario.rol === Rol.ADMIN ? undefined : usuario.id,
      turnoCajaId: filtro.turnoId,
      fecha: {
        gte: filtro.desde
          ? new Date(`${filtro.desde}T00:00:00-05:00`)
          : undefined,
        lte: filtro.hasta
          ? new Date(`${filtro.hasta}T23:59:59.999-05:00`)
          : undefined,
      },
    };
    const [total, ventas] = await this.prisma.$transaction([
      this.prisma.venta.count({ where }),
      this.prisma.venta.findMany({
        where,
        include: {
          cliente: { select: { id: true, nombre: true } },
          usuario: { select: { id: true, nombre: true } },
          _count: { select: { detalles: true } },
        },
        orderBy: { fecha: 'desc' },
        skip: (filtro.pagina - 1) * filtro.limite,
        take: filtro.limite,
      }),
    ]);
    return {
      datos: ventas,
      total,
      pagina: filtro.pagina,
      limite: filtro.limite,
    };
  }

  async obtener(id: number, usuario: UsuarioAutenticado) {
    const venta = await this.prisma.venta.findUnique({
      where: { id },
      include: INCLUIR_DETALLE,
    });
    if (!venta) throw new NotFoundException('Venta no encontrada');
    if (usuario.rol !== Rol.ADMIN && venta.usuarioId !== usuario.id) {
      throw new ForbiddenException('Solo puedes ver tus propias ventas');
    }
    return venta;
  }

  /**
   * Anula una venta: NO se borra. Cambia a ANULADA y devuelve el stock
   * con movimientos de AJUSTE que indican el motivo.
   * - El ADMIN puede anular cualquier venta.
   * - El cajero solo las suyas y mientras su turno siga abierto.
   */
  async anular(id: number, dto: AnularVentaDto, usuario: UsuarioAutenticado) {
    await this.prisma.$transaction(async (tx) => {
      // Dentro de la transacción se consulta una tabla a la vez (sin include):
      // la conexión de PostgreSQL atiende una consulta por vez
      const venta = await tx.venta.findUnique({ where: { id } });
      if (!venta) throw new NotFoundException('Venta no encontrada');
      const turnoCaja = await tx.turnoCaja.findUniqueOrThrow({
        where: { id: venta.turnoCajaId },
      });
      const detalles = await tx.detalleVenta.findMany({
        where: { ventaId: id },
      });

      if (usuario.rol !== Rol.ADMIN) {
        if (venta.usuarioId !== usuario.id) {
          throw new ForbiddenException('Solo puedes anular tus propias ventas');
        }
        if (turnoCaja.estado !== EstadoTurno.ABIERTO) {
          throw new ForbiddenException(
            'El turno de esta venta ya se cerró: solo el administrador puede anularla',
          );
        }
      }

      // Anular un fiado resta su total de la deuda del cliente. Si el cliente ya
      // abonó ese dinero, la deuda quedaría negativa: primero hay que devolvérselo.
      if (
        venta.metodoPago === MetodoPago.FIADO &&
        venta.estado === EstadoVenta.PAGADA &&
        venta.clienteId
      ) {
        await this.clientes.bloquear(venta.clienteId, tx);
        const deuda = await this.clientes.deuda(venta.clienteId, tx);
        if (deuda.lt(venta.total)) {
          throw new ConflictException(
            `No se puede anular: el cliente debe S/ ${deuda.toFixed(2)} y la venta es de S/ ${venta.total.toFixed(2)}. Ya abonó parte de este fiado; devuélvele la diferencia antes de anular`,
          );
        }
      }

      // Cambio condicional: si dos personas anulan a la vez, solo una lo logra
      const { count } = await tx.venta.updateMany({
        where: { id, estado: EstadoVenta.PAGADA },
        data: { estado: EstadoVenta.ANULADA },
      });
      if (count === 0)
        throw new ConflictException('La venta ya estaba anulada');

      for (const d of detalles) {
        await tx.producto.update({
          where: { id: d.productoId },
          data: { stock: { increment: d.cantidad } },
        });
      }
      await tx.movimientoInventario.createMany({
        data: detalles.map((d) => ({
          productoId: d.productoId,
          ventaId: venta.id,
          usuarioId: usuario.id,
          tipo: TipoMovimiento.AJUSTE,
          cantidad: d.cantidad, // vuelve al inventario
          motivo: `Anulación de venta #${venta.id}: ${dto.motivo.trim()}`,
        })),
      });
    });

    return this.prisma.venta.findUniqueOrThrow({
      where: { id },
      include: INCLUIR_DETALLE,
    });
  }
}
