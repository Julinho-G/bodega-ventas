import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurarApp(app); // prefijo /api, validación y CORS

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API de la bodega lista en http://localhost:${port}/api`);
}
void bootstrap();
