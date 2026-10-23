/**
 * Prepara una base de datos NUEVA de producción. El contenedor de la API lo ejecuta
 * cada vez que arranca, después de aplicar las migraciones:
 *   - Si no hay ningún usuario, crea "admin" con la contraseña de ADMIN_PASSWORD.
 *   - Si no hay categorías, crea las típicas de una bodega.
 * NO crea productos de ejemplo (eso lo hace el seed, solo para desarrollo).
 * Si la base ya tiene datos, no cambia nada.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { CATEGORIAS_INICIALES } from './common/categorias-iniciales';
import { PrismaClient, Rol } from './generated/prisma/client';

// Script independiente (como el seed): por eso crea su propio cliente de Prisma
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  if ((await prisma.usuario.count()) === 0) {
    const password = process.env.ADMIN_PASSWORD ?? '';
    if (password.length < 8) {
      throw new Error(
        'La base está vacía y falta ADMIN_PASSWORD (mínimo 8 caracteres) en produccion/.env: es la contraseña del usuario "admin".',
      );
    }
    await prisma.usuario.create({
      data: {
        nombre: 'Administrador',
        usuario: 'admin',
        passwordHash: await bcrypt.hash(password, 10),
        rol: Rol.ADMIN,
      },
    });
    console.log(
      '[inicializar] Usuario "admin" creado con la contraseña de ADMIN_PASSWORD.',
    );
  }

  if ((await prisma.categoria.count()) === 0) {
    await prisma.categoria.createMany({
      data: CATEGORIAS_INICIALES.map((nombre) => ({ nombre })),
    });
    console.log(
      `[inicializar] ${CATEGORIAS_INICIALES.length} categorías creadas.`,
    );
  }
}

main()
  .catch((e: unknown) => {
    console.error(
      `[inicializar] ${e instanceof Error ? e.message : String(e)}`,
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
