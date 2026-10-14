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
} from '../generated/prisma/client';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { aDecimal } from '../common/decimal';
import { PrismaService } from '../prisma/prisma.service';

/** Cliente de BD normal o el de una transacción en curso */
type Db = PrismaService | Prisma.TransactionClient;

const CERO = new Prisma.Decimal(0);

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Un usuario solo puede tener UN turno abierto a la vez */
  async abrir(usuarioId: number, montoInicial: number) {
    const abierto = await this.buscarTurnoAbierto(usuarioId);
    if (abierto) {
      throw new ConflictException(
        `Ya tienes la caja abierta desde ${abierto.apertura.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`,
      );
    }
    return this.prisma.turnoCaja.create({
      data: { usuarioId, montoInicial: aDecimal(montoInicial) },
    });
  }

  /** Turno abierto del usuario con su resumen en vivo */
  async actual(usuarioId: number) {
    const turno = await this.obtenerTurnoAbierto(usuarioId);
    return { turno, resumen: await this.resumen(turno.id) };
  }

  /**
   * Cierra el turno: compara el efectivo que DEBERÍA haber con el que se contó.
   * diferencia > 0 → sobra dinero;  diferencia < 0 → falta dinero.
   */
  async cerrar(usuarioId: number, montoContado: number) {
    const turno = await this.obtenerTurnoAbierto(usuarioId);
    const resumen = await this.resumen(turno.id);
    const contado = aDecimal(montoContado);

    const cerrado = await this.prisma.turnoCaja.update({
      where: { id: turno.id },
      data: {
        estado: EstadoTurno.CERRADO,
        cierre: new Date(),
        montoContado: contado,
      },
    });

    return {
      turno: cerrado,
      resumen,
      montoContado: contado,
      diferencia: contado.minus(resumen.efectivoEsperado),
    };
  }

  /** Historial de turnos (para el administrador) */
  async listarTurnos(limite = 30) {
    const turnos = await this.prisma.turnoCaja.findMany({
      orderBy: { apertura: 'desc' },
      take: limite,
      include: { usuario: { select: { id: true, nombre: true } } },
    });
    return Promise.all(
      turnos.map(async (t) => {
        const resumen = await this.resumen(t.id);
        return {
          ...t,
          efectivoEsperado: resumen.efectivoEsperado,
          totalVendido: resumen.totalVendido,
          diferencia: t.montoContado
            ? t.montoContado.minus(resumen.efectivoEsperado)
            : null,
        };
      }),
    );
  }

  /** Detalle de un turno: el ADMIN ve cualquiera, el cajero solo los suyos */
  async detalleTurno(id: number, usuario: UsuarioAutenticado) {
    const turno = await this.prisma.turnoCaja.findUnique({
      where: { id },
      include: { usuario: { select: { id: true, nombre: true } } },
    });
    if (!turno) throw new NotFoundException('Turno no encontrado');
    if (usuario.rol !== Rol.ADMIN && turno.usuarioId !== usuario.id) {
      throw new ForbiddenException('Solo puedes ver tus propios turnos');
    }
    return { turno, resumen: await this.resumen(id) };
  }

  // ---------------- Usado también por el módulo de ventas ----------------

  buscarTurnoAbierto(usuarioId: number, db: Db = this.prisma) {
    return db.turnoCaja.findFirst({
      where: { usuarioId, estado: EstadoTurno.ABIERTO },
    });
  }

  async obtenerTurnoAbierto(usuarioId: number, db: Db = this.prisma) {
    const turno = await this.buscarTurnoAbierto(usuarioId, db);
    if (!turno) {
      throw new BadRequestException(
        'No tienes la caja abierta. Abre tu turno antes de continuar',
      );
    }
    return turno;
  }

  /**
   * Cuadre del turno (solo ventas PAGADAS; las anuladas no cuentan):
   *   efectivo esperado = monto inicial + ventas en EFECTIVO + pagos de fiado recibidos
   * Yape, Plin y tarjeta se reportan aparte porque ese dinero no está en el cajón.
   */
  async resumen(turnoId: number) {
    const turno = await this.prisma.turnoCaja.findUniqueOrThrow({
      where: { id: turnoId },
    });

    const porMetodo = await this.prisma.venta.groupBy({
      by: ['metodoPago'],
      where: { turnoCajaId: turnoId, estado: EstadoVenta.PAGADA },
      _sum: { total: true },
      _count: { _all: true },
    });
    const anuladas = await this.prisma.venta.count({
      where: { turnoCajaId: turnoId, estado: EstadoVenta.ANULADA },
    });
    const pagos = await this.prisma.pagoFiado.aggregate({
      where: { turnoCajaId: turnoId },
      _sum: { monto: true },
    });

    // Todos los métodos aparecen, aunque tengan 0 ventas
    const ventasPorMetodo = Object.values(MetodoPago).map((metodo) => {
      const fila = porMetodo.find((f) => f.metodoPago === metodo);
      return {
        metodo,
        cantidad: fila?._count._all ?? 0,
        total: fila?._sum.total ?? CERO,
      };
    });

    const totalDe = (m: MetodoPago) =>
      ventasPorMetodo.find((v) => v.metodo === m)!.total;
    const totalVendido = ventasPorMetodo.reduce(
      (acc, v) => acc.plus(v.total),
      CERO,
    );
    const pagosFiado = pagos._sum.monto ?? CERO;

    return {
      montoInicial: turno.montoInicial,
      ventasPorMetodo,
      cantidadVentas: ventasPorMetodo.reduce((acc, v) => acc + v.cantidad, 0),
      ventasAnuladas: anuladas,
      totalVendido,
      pagosFiadoRecibidos: pagosFiado,
      efectivoEsperado: turno.montoInicial
        .plus(totalDe(MetodoPago.EFECTIVO))
        .plus(pagosFiado),
    };
  }
}
