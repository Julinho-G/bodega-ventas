import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Se lee del archivo .env. Si falta, "prisma generate" igual funciona;
    // "prisma migrate" mostrará un error pidiendo la conexión.
    url: process.env.DATABASE_URL ?? '',
  },
});
