import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarApp } from './../src/configurar-app';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Pruebas de punta a punta: levantan la API real contra la base de datos del .env.
 * Requisito: haber ejecutado la migración y el seed (usuario admin / admin123).
 */
describe('API Bodega (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let tokenCajero: string;
  let idCajero: number;
  const usuarioPrueba = `cajero_e2e_${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configurarApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Limpieza: se borra el cajero creado durante la prueba
    await prisma.usuario.deleteMany({ where: { usuario: usuarioPrueba } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('GET /api/health es pública', () => http().get('/api/health').expect(200));

  it('rechaza rutas protegidas sin token (401)', () =>
    http().get('/api/auth/perfil').expect(401));

  it('rechaza contraseña incorrecta (401)', () =>
    http()
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'mala' })
      .expect(401));

  it('valida el cuerpo del login (400)', () =>
    http().post('/api/auth/login').send({ usuario: 'admin' }).expect(400));

  it('el admin inicia sesión y recibe un token', async () => {
    const res = await http()
      .post('/api/auth/login')
      .send({ usuario: 'Admin', password: 'admin123' }) // mayúsculas no importan
      .expect(200);
    const body = res.body as { accessToken: string; usuario: { rol: string } };
    expect(body.accessToken).toBeDefined();
    expect(body.usuario.rol).toBe('ADMIN');
    tokenAdmin = body.accessToken;
  });

  it('GET /api/auth/perfil devuelve al usuario del token', async () => {
    const res = await http()
      .get('/api/auth/perfil')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect((res.body as { usuario: string }).usuario).toBe('admin');
  });

  it('el admin lista usuarios sin exponer contraseñas', async () => {
    const res = await http()
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const lista = res.body as Record<string, unknown>[];
    expect(lista.length).toBeGreaterThan(0);
    expect(lista[0]).not.toHaveProperty('passwordHash');
  });

  it('el admin crea un cajero', async () => {
    const res = await http()
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nombre: 'Cajero Prueba',
        usuario: usuarioPrueba,
        password: 'caja123',
      })
      .expect(201);
    const body = res.body as { id: number; rol: string };
    expect(body.rol).toBe('CAJERO');
    idCajero = body.id;
  });

  it('no permite usuarios duplicados (409)', () =>
    http()
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Otro', usuario: usuarioPrueba, password: 'caja123' })
      .expect(409));

  it('el cajero inicia sesión pero NO puede gestionar usuarios (403)', async () => {
    const res = await http()
      .post('/api/auth/login')
      .send({ usuario: usuarioPrueba, password: 'caja123' })
      .expect(200);
    tokenCajero = (res.body as { accessToken: string }).accessToken;

    await http()
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenCajero}`)
      .expect(403);
  });

  it('el admin no puede desactivarse a sí mismo (400)', async () => {
    const perfil = await http()
      .get('/api/auth/perfil')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    await http()
      .patch(`/api/usuarios/${(perfil.body as { id: number }).id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ activo: false })
      .expect(400);
  });

  it('al desactivar al cajero, su token deja de servir (401)', async () => {
    await http()
      .patch(`/api/usuarios/${idCajero}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ activo: false })
      .expect(200);

    await http()
      .get('/api/auth/perfil')
      .set('Authorization', `Bearer ${tokenCajero}`)
      .expect(401);
  });
});
