import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TipoMovimiento,
  UnidadMedida,
} from '../generated/prisma/client';
import { aDecimal } from '../common/decimal';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { FiltroProductosDto } from './dto/filtro-productos.dto';

// Qué se devuelve de cada producto (incluye el nombre de su categoría)
const INCLUIR_CATEGORIA = {
  categoria: { select: { id: true, nombre: true } },
} satisfies Prisma.ProductoInclude;

type ProductoConCategoria = Prisma.ProductoGetPayload<{
  include: typeof INCLUIR_CATEGORIA;
}>;

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Búsqueda paginada por nombre o código, con filtro por categoría */
  async listar(filtro: FiltroProductosDto) {
    const texto = filtro.buscar?.trim();
    const where: Prisma.ProductoWhereInput = {
      activo: filtro.incluirInactivos ? undefined : true,
      categoriaId: filtro.categoriaId,
      OR: texto
        ? [
            { nombre: { contains: texto, mode: 'insensitive' } },
            { codigoBarras: texto },
          ]
        : undefined,
    };

    const [total, productos] = await this.prisma.$transaction([
      this.prisma.producto.count({ where }),
      this.prisma.producto.findMany({
        where,
        include: INCLUIR_CATEGORIA,
        orderBy: { nombre: 'asc' },
        skip: (filtro.pagina - 1) * filtro.limite,
        take: filtro.limite,
      }),
    ]);

    return {
      datos: productos.map((p) => this.formatear(p)),
      total,
      pagina: filtro.pagina,
      limite: filtro.limite,
    };
  }

  /** Para la caja: el lector de código de barras llama a esta ruta */
  async buscarPorCodigo(codigo: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { codigoBarras: codigo.trim() },
      include: INCLUIR_CATEGORIA,
    });
    if (!producto || !producto.activo) {
      throw new NotFoundException(`No hay producto con el código ${codigo}`);
    }
    return this.formatear(producto);
  }

  /** Productos activos cuyo stock llegó al mínimo o menos (para reponer) */
  async stockBajo() {
    const productos = await this.prisma.producto.findMany({
      where: {
        activo: true,
        // Compara dos columnas de la misma fila: stock <= stock_minimo
        stock: { lte: this.prisma.producto.fields.stockMinimo },
      },
      include: INCLUIR_CATEGORIA,
      orderBy: { stock: 'asc' },
    });
    return productos.map((p) => this.formatear(p));
  }

  async obtener(id: number) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      include: INCLUIR_CATEGORIA,
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return this.formatear(producto);
  }

  /**
   * Crea el producto. Si trae stock inicial, registra también el movimiento
   * de ENTRADA en la misma transacción (todo cambio de stock queda auditado).
   */
  async crear(dto: CrearProductoDto, usuarioId: number) {
    const unidad = dto.unidad ?? UnidadMedida.UND;
    const stockInicial = dto.stockInicial ?? 0;
    const stockMinimo = dto.stockMinimo ?? 0;

    this.validarPrecios(dto.precioCompra, dto.precioVenta);
    this.validarCantidadesSegunUnidad(unidad, [stockInicial, stockMinimo]);
    await this.validarCategoria(dto.categoriaId);
    await this.validarNombreLibre(dto.nombre);
    if (dto.codigoBarras) await this.validarCodigoLibre(dto.codigoBarras);

    const producto = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.producto.create({
        data: {
          codigoBarras: dto.codigoBarras || null,
          nombre: dto.nombre,
          categoriaId: dto.categoriaId,
          unidad,
          precioCompra: aDecimal(dto.precioCompra),
          precioVenta: aDecimal(dto.precioVenta),
          stock: aDecimal(stockInicial),
          stockMinimo: aDecimal(stockMinimo),
        },
        include: INCLUIR_CATEGORIA,
      });

      if (stockInicial > 0) {
        await tx.movimientoInventario.create({
          data: {
            productoId: creado.id,
            usuarioId,
            tipo: TipoMovimiento.ENTRADA,
            cantidad: aDecimal(stockInicial),
            motivo: 'Stock inicial',
          },
        });
      }
      return creado;
    });

    return this.formatear(producto);
  }

  async actualizar(id: number, dto: ActualizarProductoDto) {
    const actual = await this.prisma.producto.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Producto no encontrado');

    // Se valida con el valor nuevo si llega, o con el actual si no cambia
    this.validarPrecios(
      dto.precioCompra ?? actual.precioCompra.toNumber(),
      dto.precioVenta ?? actual.precioVenta.toNumber(),
    );
    const unidad = dto.unidad ?? actual.unidad;
    this.validarCantidadesSegunUnidad(unidad, [
      actual.stock.toNumber(),
      dto.stockMinimo ?? actual.stockMinimo.toNumber(),
    ]);
    if (dto.categoriaId !== undefined)
      await this.validarCategoria(dto.categoriaId);
    if (dto.nombre) await this.validarNombreLibre(dto.nombre, id);
    if (dto.codigoBarras) await this.validarCodigoLibre(dto.codigoBarras, id);

    const producto = await this.prisma.producto.update({
      where: { id },
      data: {
        codigoBarras: dto.codigoBarras === '' ? null : dto.codigoBarras,
        nombre: dto.nombre,
        categoriaId: dto.categoriaId,
        unidad: dto.unidad,
        precioCompra:
          dto.precioCompra !== undefined
            ? aDecimal(dto.precioCompra)
            : undefined,
        precioVenta:
          dto.precioVenta !== undefined ? aDecimal(dto.precioVenta) : undefined,
        stockMinimo:
          dto.stockMinimo !== undefined ? aDecimal(dto.stockMinimo) : undefined,
        activo: dto.activo,
      },
      include: INCLUIR_CATEGORIA,
    });
    return this.formatear(producto);
  }

  // ---------------- Reglas de negocio ----------------

  /** Evita registrar por error un precio de venta menor al costo */
  private validarPrecios(precioCompra: number, precioVenta: number) {
    if (aDecimal(precioVenta).lt(aDecimal(precioCompra))) {
      throw new BadRequestException(
        'El precio de venta no puede ser menor que el precio de compra',
      );
    }
  }

  /** Un producto por unidad (UND) no puede tener stock fraccionado: 2.5 latas no existen */
  private validarCantidadesSegunUnidad(
    unidad: UnidadMedida,
    cantidades: number[],
  ) {
    if (
      unidad === UnidadMedida.UND &&
      cantidades.some((c) => !Number.isInteger(c))
    ) {
      throw new BadRequestException(
        'Los productos por unidad (UND) solo admiten cantidades enteras',
      );
    }
  }

  private async validarCategoria(categoriaId: number) {
    const existe = await this.prisma.categoria.findUnique({
      where: { id: categoriaId },
    });
    if (!existe) throw new BadRequestException('La categoría no existe');
  }

  private async validarNombreLibre(nombre: string, idActual?: number) {
    const existe = await this.prisma.producto.findFirst({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        NOT: idActual ? { id: idActual } : undefined,
      },
    });
    if (existe) {
      throw new ConflictException(`Ya existe el producto "${existe.nombre}"`);
    }
  }

  private async validarCodigoLibre(codigo: string, idActual?: number) {
    const existe = await this.prisma.producto.findUnique({
      where: { codigoBarras: codigo },
    });
    if (existe && existe.id !== idActual) {
      throw new ConflictException(
        `El código ${codigo} ya pertenece a "${existe.nombre}"`,
      );
    }
  }

  /** Agrega el indicador stockBajo, útil para pintar alertas en el frontend */
  private formatear(p: ProductoConCategoria) {
    return { ...p, stockBajo: p.activo && p.stock.lte(p.stockMinimo) };
  }
}
