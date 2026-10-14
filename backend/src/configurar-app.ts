import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Configuración común de la aplicación.
 * La usan main.ts y las pruebas e2e, para que las pruebas se comporten igual que la app real.
 */
export function configurarApp(app: INestApplication): void {
  // Todas las rutas empiezan con /api  (ej: /api/productos)
  app.setGlobalPrefix('api');

  // Valida automáticamente los datos que llegan (DTOs) y descarta campos no declarados
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Permite que el frontend (React en el puerto 5173) consuma la API
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  });
}
