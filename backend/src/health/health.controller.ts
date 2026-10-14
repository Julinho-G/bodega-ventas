import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * GET /api/health
 * Sirve para comprobar que la API está viva y que la base de datos responde.
 * Es pública: no necesita token.
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let db = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'sin conexión';
    }
    return { status: 'ok', db, fecha: new Date().toISOString() };
  }
}
