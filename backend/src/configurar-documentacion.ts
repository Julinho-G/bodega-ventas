import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const DESCRIPCION = `
API del sistema de ventas para bodega (ventas en tienda).

**Cómo probar desde esta página**
1. Abre *Acceso → POST /api/auth/login*, pulsa **Try it out** y envía \`{ "usuario": "admin", "password": "admin123" }\`.
2. Copia el \`accessToken\` de la respuesta.
3. Pulsa **Authorize** (arriba a la derecha), pega el token y acepta. Desde ahí todas las rutas lo envían.

**Convenciones**
- Los montos y cantidades llegan como **texto** con decimales exactos (ej. \`"12.50"\`), para no perder céntimos.
- Las fechas de los filtros son días de Lima en formato \`AAAA-MM-DD\`.
- Los errores responden \`{ statusCode, message, error }\`; \`message\` viene en español y puede ser una lista.
- 401: falta el token o venció · 403: el rol no tiene permiso · 400: datos inválidos o regla del negocio.
`;

/**
 * Documentación interactiva de la API (Swagger / OpenAPI).
 *   Página:  http://localhost:3000/api/docs
 *   JSON:    http://localhost:3000/api/docs-json  (para importarlo en Postman o Insomnia)
 * Se desactiva con API_DOCS=false en el .env (por ejemplo, en producción).
 */
export function configurarDocumentacion(app: INestApplication): void {
  if (process.env.API_DOCS === 'false') return;

  const config = new DocumentBuilder()
    .setTitle('API de la bodega')
    .setDescription(DESCRIPCION)
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Pega aquí el accessToken que devuelve el login',
    })
    .build();

  const documento = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documento, {
    customSiteTitle: 'API de la bodega',
    swaggerOptions: {
      persistAuthorization: true, // el token no se pierde al recargar la página
      docExpansion: 'none', // las secciones empiezan cerradas
      tagsSorter: 'alpha',
    },
  });
}
