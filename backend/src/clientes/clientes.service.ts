import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoVenta,
  MetodoPago,
  Prisma,
  Rol,
} from '../generated/prisma/client';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { CajaService } from '../caja/caja.service';
import { aDecimal } from '../common/decimal';
import { patronContiene } from '../common/busqueda';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarClienteDto,
  CrearClienteDto,
  FiltroClientesDto,
  RegistrarPagoDto,
} from './dto/cliente.dto';

type Db = PrismaService | Prisma.TransactionClient;

const CERO = new Prisma.Decimal(0);

// Solo cuentan las ventas al fiado que no fueron anuladas
const VENTAS_FIADAS = {
  metodoPago: MetodoPago.FIADO,
  estado: EstadoVenta.PAGADA,
} satisfies Prisma.VentaWhereInput;

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caja: CajaService,
  ) {}

  // ---------------- Consultas ----------------

  /** Lista clientes con su deuda y crédito disponible */
  async listar(filtro: FiltroClientesDto) {
    const texto = filtro.buscar?.trim();
    // Nombre sin importar mayúsculas ni tildes ("nunez" encuentra "Núñez"), o DNI exacto
    const coinciden = texto
      ? await this.prisma.$queryRaw<{ id: number }[]>`
          SELECT id FROM clientes
          WHERE unaccent(nombre) ILIKE unaccent(${patronContiene(texto)})
             OR dni = ${texto}`
      : null;
    const clientes = await this.prisma.cliente.findMany({
      where: coinciden ? { id: { in: coinciden.map((c) => c.id) } } : undefined,
      orderBy: { nombre: 'asc' },
    });

    // Deudas de todos los clientes en 2 consultas (no una por cliente)
    const ids = clientes.map((c) => c.id);
    const [fiados, pagos] = await Promise.all([
      this.prisma.venta.groupBy({
        by: ['clienteId'],
        where: { ...VENTAS_FIADAS, clienteId: { in: ids } },
        _sum: { total: true },
      }),
      this.prisma.pagoFiado.groupBy({
        by: ['clienteId'],
        where: { clienteId: { in: ids } },
        _sum: { monto: true },
      }),
    ]);

    const resultado = clientes.map((c) => {
      const fiado =
        fiados.find((f) => f.clienteId === c.id)?._sum.total ?? CERO;
      const pagado =
        pagos.find((p) => p.clienteId === c.id)?._sum.monto ?? CERO;
      return this.conCredito(c, fiado.minus(pagado));
    });

    return filtro.soloDeudores
      ? resultado
          .filter((c) => c.deuda.gt(0))
          .sort((a, b) => b.deuda.comparedTo(a.deuda)) // el que más debe primero
      : resultado;
  }

  async obtener(id: number) {
    const cliente = await this.buscar(id);
    return this.conCredito(cliente, await this.deuda(id));
  }

  /**
   * Estado de cuenta: cada fiado suma (cargo) y cada pago resta (abono),
   * en orden de fecha y con el saldo acumulado línea por línea.
   */
  async estadoCuenta(id: number) {
    const cliente = await this.buscar(id);
    const [ventas, pagos] = await Promise.all([
      this.prisma.venta.findMany({
        where: { ...VENTAS_FIADAS, clienteId: id },
        include: {
          detalles: {
            include: { producto: { select: { nombre: true, unidad: true } } },
          },
        },
      }),
      this.prisma.pagoFiado.findMany({ where: { clienteId: id } }),
    ]);

    const movimientos = [
      ...ventas.map((v) => ({
        tipo: 'FIADO' as const,
        fecha: v.fecha,
        ventaId: v.id,
        detalle: v.detalles
          .map(
            (d) =>
              `${d.cantidad.toString()} ${d.producto.unidad} ${d.producto.nombre}`,
          )
          .join(', '),
        cargo: v.total,
        abono: CERO,
      })),
      ...pagos.map((p) => ({
        tipo: 'PAGO' as const,
        fecha: p.fecha,
        ventaId: null as number | null,
        detalle: 'Pago a cuenta',
        cargo: CERO,
        abono: p.monto,
      })),
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    let saldo = CERO;
    const conSaldo = movimientos.map((m) => {
      saldo = saldo.plus(m.cargo).minus(m.abono);
      return { ...m, saldo };
    });

    return { cliente: this.conCredito(cliente, saldo), movimientos: conSaldo };
  }

  // ---------------- Escritura ----------------

  async crear(dto: CrearClienteDto, usuario: UsuarioAutenticado) {
    this.validarPermisoLimite(dto.limiteCredito, usuario);
    if (dto.dni) await this.validarDniLibre(dto.dni);

    const cliente = await this.prisma.cliente.create({
      data: {
        nombre: dto.nombre,
        dni: dto.dni || null,
        telefono: dto.telefono || null,
        limiteCredito: aDecimal(dto.limiteCredito ?? 0),
      },
    });
    return this.conCredito(cliente, CERO);
  }

  async actualizar(
    id: number,
    dto: ActualizarClienteDto,
    usuario: UsuarioAutenticado,
  ) {
    await this.buscar(id);
    this.validarPermisoLimite(dto.limiteCredito, usuario);
    if (dto.dni) await this.validarDniLibre(dto.dni, id);

    const cliente = await this.prisma.cliente.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        dni: dto.dni === '' ? null : dto.dni,
        telefono: dto.telefono === '' ? null : dto.telefono,
        limiteCredito:
          dto.limiteCredito !== undefined
            ? aDecimal(dto.limiteCredito)
            : undefined,
      },
    });
    return this.conCredito(cliente, await this.deuda(id));
  }

  /**
   * El cliente paga (todo o parte) de lo que debe. El dinero entra al cajón,
   * por eso exige la caja abierta y suma al efectivo esperado del turno.
   */
  async registrarPago(
    id: number,
    dto: RegistrarPagoDto,
    usuario: UsuarioAutenticado,
  ) {
    const monto = aDecimal(dto.monto);

    return this.prisma.$transaction(async (tx) => {
      const turno = await this.caja.obtenerTurnoAbierto(usuario.id, tx);
      const cliente = await this.bloquear(id, tx);
      const deuda = await this.deuda(id, tx);

      if (deuda.lte(0)) {
        throw new BadRequestException(`${cliente.nombre} no tiene deuda`);
      }
      if (monto.gt(deuda)) {
        throw new BadRequestException(
          `El pago (S/ ${monto.toFixed(2)}) es mayor que la deuda (S/ ${deuda.toFixed(2)})`,
        );
      }

      const pago = await tx.pagoFiado.create({
        data: { clienteId: id, turnoCajaId: turno.id, monto },
      });
      const deudaRestante = deuda.minus(monto);
      return {
        pago,
        deudaAnterior: deuda,
        deudaRestante,
        cliente: this.conCredito(cliente, deudaRestante),
      };
    });
  }

  // ---------------- Usado también por Ventas ----------------

  /**
   * Bloquea la fila del cliente hasta que termine la transacción (SELECT ... FOR UPDATE).
   * Si dos cajas fían o cobran al mismo cliente a la vez, la segunda espera a la
   * primera y calcula la deuda ya actualizada: así nunca se supera el límite.
   */
  async bloquear(id: number, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM clientes WHERE id = ${id} FOR UPDATE`;
    const cliente = await tx.cliente.findUnique({ where: { id } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  /** Deuda = ventas al FIADO no anuladas − pagos realizados */
  async deuda(clienteId: number, db: Db = this.prisma) {
    const fiado = await db.venta.aggregate({
      where: { ...VENTAS_FIADAS, clienteId },
      _sum: { total: true },
    });
    const pagos = await db.pagoFiado.aggregate({
      where: { clienteId },
      _sum: { monto: true },
    });
    return (fiado._sum.total ?? CERO).minus(pagos._sum.monto ?? CERO);
  }

  // ---------------- Apoyo ----------------

  private async buscar(id: number) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  /** Decidir cuánto se fía es responsabilidad del dueño, no del cajero */
  private validarPermisoLimite(
    limite: number | undefined,
    usuario: UsuarioAutenticado,
  ) {
    if (limite !== undefined && usuario.rol !== Rol.ADMIN) {
      throw new ForbiddenException(
        'Solo el administrador puede asignar el límite de crédito',
      );
    }
  }

  private async validarDniLibre(dni: string, idActual?: number) {
    const existe = await this.prisma.cliente.findUnique({ where: { dni } });
    if (existe && existe.id !== idActual) {
      throw new ConflictException(
        `El DNI ${dni} ya está registrado a nombre de ${existe.nombre}`,
      );
    }
  }

  private conCredito<T extends { limiteCredito: Prisma.Decimal }>(
    cliente: T,
    deuda: Prisma.Decimal,
  ) {
    const disponible = cliente.limiteCredito.minus(deuda);
    return {
      ...cliente,
      deuda,
      creditoDisponible: disponible.gt(0) ? disponible : CERO,
    };
  }
}
