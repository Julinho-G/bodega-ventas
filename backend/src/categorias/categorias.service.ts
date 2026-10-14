import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriaDto } from './dto/categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista categorías con la cantidad de productos de cada una */
  async listar() {
    const categorias = await this.prisma.categoria.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { productos: true } } },
    });
    return categorias.map(({ _count, ...c }) => ({
      ...c,
      cantidadProductos: _count.productos,
    }));
  }

  async crear(dto: CategoriaDto) {
    await this.validarNombreLibre(dto.nombre);
    return this.prisma.categoria.create({ data: { nombre: dto.nombre } });
  }

  async renombrar(id: number, dto: CategoriaDto) {
    await this.obtener(id);
    await this.validarNombreLibre(dto.nombre, id);
    return this.prisma.categoria.update({
      where: { id },
      data: { nombre: dto.nombre },
    });
  }

  /** Solo se elimina si no tiene productos (para no dejar productos huérfanos) */
  async eliminar(id: number) {
    await this.obtener(id);
    const productos = await this.prisma.producto.count({
      where: { categoriaId: id },
    });
    if (productos > 0) {
      throw new ConflictException(
        `No se puede eliminar: la categoría tiene ${productos} producto(s)`,
      );
    }
    await this.prisma.categoria.delete({ where: { id } });
    return { eliminada: true };
  }

  private async obtener(id: number) {
    const categoria = await this.prisma.categoria.findUnique({ where: { id } });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    return categoria;
  }

  /** "bebidas" y "Bebidas" se consideran el mismo nombre */
  private async validarNombreLibre(nombre: string, idActual?: number) {
    const existe = await this.prisma.categoria.findFirst({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        NOT: idActual ? { id: idActual } : undefined,
      },
    });
    if (existe) {
      throw new ConflictException(`Ya existe la categoría "${existe.nombre}"`);
    }
  }
}
