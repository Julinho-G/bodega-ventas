/**
 * Datos iniciales de la bodega.
 * Ejecutar con:  npx prisma db seed
 * Se puede correr varias veces: usa "upsert" para no duplicar registros.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  Rol,
  UnidadMedida,
} from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // 1. Usuario administrador (¡cambia la contraseña después del primer ingreso!)
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.usuario.upsert({
    where: { usuario: 'admin' },
    update: {},
    create: {
      nombre: 'Administrador',
      usuario: 'admin',
      passwordHash,
      rol: Rol.ADMIN,
    },
  });

  // 2. Categorías típicas de una bodega
  const nombresCategorias = [
    'Abarrotes',
    'Bebidas',
    'Lácteos',
    'Limpieza',
    'Snacks',
    'Panadería',
  ];
  const categorias: Record<string, number> = {};
  for (const nombre of nombresCategorias) {
    const c = await prisma.categoria.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    categorias[nombre] = c.id;
  }

  // 3. Productos de ejemplo (unidad y granel). Precios en soles.
  const productos = [
    {
      codigoBarras: '7750243001234',
      nombre: 'Arroz Costeño 750 g',
      cat: 'Abarrotes',
      unidad: UnidadMedida.UND,
      compra: 3.6,
      venta: 4.5,
      stock: 40,
    },
    {
      codigoBarras: null,
      nombre: 'Azúcar rubia (granel)',
      cat: 'Abarrotes',
      unidad: UnidadMedida.KG,
      compra: 3.2,
      venta: 4.0,
      stock: 25,
    },
    {
      codigoBarras: '7751271012345',
      nombre: 'Aceite Primor 1 L',
      cat: 'Abarrotes',
      unidad: UnidadMedida.UND,
      compra: 8.9,
      venta: 10.5,
      stock: 18,
    },
    {
      codigoBarras: '7750182001111',
      nombre: 'Inca Kola 500 ml',
      cat: 'Bebidas',
      unidad: UnidadMedida.UND,
      compra: 1.9,
      venta: 2.5,
      stock: 48,
    },
    {
      codigoBarras: '7751271055555',
      nombre: 'Leche Gloria tarro 400 g',
      cat: 'Lácteos',
      unidad: UnidadMedida.UND,
      compra: 3.7,
      venta: 4.3,
      stock: 36,
    },
    {
      codigoBarras: null,
      nombre: 'Pan francés',
      cat: 'Panadería',
      unidad: UnidadMedida.UND,
      compra: 0.15,
      venta: 0.2,
      stock: 100,
    },
  ];

  const admin = await prisma.usuario.findUniqueOrThrow({
    where: { usuario: 'admin' },
  });

  for (const p of productos) {
    const existe = await prisma.producto.findFirst({
      where: { nombre: p.nombre },
    });
    if (existe) continue;

    // Producto + movimiento de ENTRADA en una sola transacción (stock auditable)
    await prisma.$transaction(async (tx) => {
      const prod = await tx.producto.create({
        data: {
          codigoBarras: p.codigoBarras,
          nombre: p.nombre,
          categoriaId: categorias[p.cat],
          unidad: p.unidad,
          precioCompra: p.compra,
          precioVenta: p.venta,
          stock: p.stock,
          stockMinimo: 5,
        },
      });
      await tx.movimientoInventario.create({
        data: {
          productoId: prod.id,
          usuarioId: admin.id,
          tipo: 'ENTRADA',
          cantidad: p.stock,
          motivo: 'Inventario inicial',
        },
      });
    });
  }

  console.log('Datos iniciales cargados: usuario admin / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
