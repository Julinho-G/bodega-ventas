import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';
import { configurarDocumentacion } from './configurar-documentacion';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurarApp(app); // prefijo /api, validación y CORS
  configurarDocumentacion(app); // Swagger en /api/docs

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(
    `API de BODEGA D' CONSTANTINA lista en http://localhost:${port}/api`,
  );
  if (process.env.API_DOCS !== 'false') {
    console.log(`Documentación en http://localhost:${port}/api/docs`);
  }
}
void bootstrap();
