import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarApp } from './../src/configurar-app';
import { configurarDocumentacion } from './../src/configurar-documentacion';

type Operacion = {
  tags?: string[];
  security?: unknown[];
  responses: Record<string, unknown>;
};
type Documento = { paths: Record<string, Record<string, Operacion>> };

/** La documentación Swagger se genera y refleja quién puede usar cada ruta */
describe('Documentación de la API (e2e)', () => {
  async function crearApp(apiDocs?: string) {
    if (apiDocs === undefined) delete process.env.API_DOCS;
    else process.env.API_DOCS = apiDocs;
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app: INestApplication<App> = modulo.createNestApplication();
    configurarApp(app);
    configurarDocumentacion(app);
    await app.init();
    return app;
  }

  describe('activada (por defecto)', () => {
    let app: INestApplication<App>;
    let doc: Documento;
    beforeAll(async () => {
      app = await crearApp();
      const res = await request(app.getHttpServer())
        .get('/api/docs-json')
        .expect(200);
      doc = res.body as Documento;
    });
    afterAll(() => app.close());

    const op = (ruta: string, metodo: string) => doc.paths[ruta]?.[metodo];

    it('la página /api/docs abre sin token', () =>
      request(app.getHttpServer())
        .get('/api/docs')
        .expect(200)
        .expect('Content-Type', /html/));

    it('documenta todas las rutas, cada una con su sección', () => {
      const operaciones = Object.values(doc.paths).flatMap((o) =>
        Object.values(o),
      );
      expect(operaciones.length).toBeGreaterThanOrEqual(39);
      for (const o of operaciones) expect(o.tags?.length).toBe(1);
    });

    it('login y health no piden token; el resto sí', () => {
      expect(op('/api/auth/login', 'post')?.security).toBeUndefined();
      expect(op('/api/health', 'get')?.security).toBeUndefined();
      expect(op('/api/auth/perfil', 'get')?.security).toEqual([{ bearer: [] }]);
      expect(op('/api/ventas', 'post')?.security).toEqual([{ bearer: [] }]);
    });

    it('las rutas solo para ADMIN muestran la respuesta 403', () => {
      expect(op('/api/reportes/resumen', 'get')?.responses).toHaveProperty(
        '403',
      );
      expect(op('/api/productos', 'post')?.responses).toHaveProperty('403');
      expect(op('/api/productos', 'get')?.responses).not.toHaveProperty('403');
    });
  });

  it('con API_DOCS=false no se publica', async () => {
    const app = await crearApp('false');
    await request(app.getHttpServer()).get('/api/docs-json').expect(404);
    await app.close();
    delete process.env.API_DOCS;
  });
});
