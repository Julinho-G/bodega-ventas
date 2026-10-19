import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarApp } from './../src/configurar-app';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Pruebas de clientes y fiado contra la base de datos del .env.
 * Crea sus propios usuarios, producto y clientes, y los borra al final.
 */
describe('Clientes y fiado (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const sufijo = Date.now().toString().slice(-6);
  // DNI de prueba único: 8 dígitos terminados en el sufijo
  const dni = `90${sufijo}`;

  let tokenAdmin: string;
  let tokenCajero: string;
  let tokenSinCaja: string;
  let idProducto: number; // UND a S/ 5.00, stock 100
  let idRosa: number; // límite S/ 20.00
  let idVenta10: number;
  let idVenta6: number | undefined;

  type Cliente = {
    id: number;
    deuda: string;
    creditoDisponible: string;
    limiteCredito: string;
  };

  const http = () => request(app.getHttpServer());
  const con = (token: string, r: request.Test) =>
    r.set('Authorization', `Bearer ${token}`);
  const deudaDe = async (id: number) => {
    const res = await con(tokenCajero, http().get(`/api/clientes/${id}`));
    return Number((res.body as Cliente).deuda);
  };
  const fiar = (cantidad: number) =>
    con(tokenCajero, http().post('/api/ventas')).send({
      items: [{ productoId: idProducto, cantidad }],
      metodoPago: 'FIADO',
      clienteId: idRosa,
    });

  async function login(usuario: string, password: string) {
    const res = await http()
      .post('/api/auth/login')
      .send({ usuario, password });
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configurarApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    tokenAdmin = await login('admin', 'admin123');
    for (const nombre of ['cli1', 'cli2']) {
      await con(tokenAdmin, http().post('/api/usuarios')).send({
        nombre,
        usuario: `${nombre}_${sufijo}`,
        password: 'caja123',
      });
    }
    tokenCajero = await login(`cli1_${sufijo}`, 'caja123');
    tokenSinCaja = await login(`cli2_${sufijo}`, 'caja123');

    const categoria = await prisma.categoria.findFirstOrThrow();
    idProducto = (
      await prisma.producto.create({
        data: {
          nombre: `Leche prueba ${sufijo}`,
          categoriaId: categoria.id,
          precioCompra: 4,
          precioVenta: 5,
          stock: 100,
        },
      })
    ).id;

    await con(tokenCajero, http().post('/api/caja/abrir')).send({
      montoInicial: 0,
    });
  });

  afterAll(async () => {
    const usuarios = await prisma.usuario.findMany({
      where: { usuario: { endsWith: `_${sufijo}` } },
    });
    const idsUsuarios = usuarios.map((u) => u.id);
    const clientes = await prisma.cliente.findMany({
      where: { nombre: { contains: sufijo } },
    });
    const idsClientes = clientes.map((c) => c.id);
    const ventas = await prisma.venta.findMany({
      where: { usuarioId: { in: idsUsuarios } },
    });
    const idsVentas = ventas.map((v) => v.id);

    await prisma.movimientoInventario.deleteMany({
      where: {
        OR: [{ productoId: idProducto }, { ventaId: { in: idsVentas } }],
      },
    });
    await prisma.venta.deleteMany({ where: { id: { in: idsVentas } } });
    await prisma.pagoFiado.deleteMany({
      where: { clienteId: { in: idsClientes } },
    });
    await prisma.turnoCaja.deleteMany({
      where: { usuarioId: { in: idsUsuarios } },
    });
    await prisma.producto.deleteMany({ where: { id: idProducto } });
    await prisma.cliente.deleteMany({ where: { id: { in: idsClientes } } });
    await prisma.usuario.deleteMany({ where: { id: { in: idsUsuarios } } });
    await app.close();
  });

  // ---------------- Registro de clientes ----------------

  it('el cajero registra un cliente (sin límite de crédito)', async () => {
    const res = await con(tokenCajero, http().post('/api/clientes'))
      .send({ nombre: `Don Pepe ${sufijo}`, telefono: '987654321' })
      .expect(201);
    expect(Number((res.body as Cliente).limiteCredito)).toBe(0);
  });

  it('el cajero NO puede asignar límite de crédito (403)', () =>
    con(tokenCajero, http().post('/api/clientes'))
      .send({ nombre: `Fiador ${sufijo}`, limiteCredito: 500 })
      .expect(403));

  it('el admin registra un cliente con DNI y límite de S/ 20', async () => {
    const res = await con(tokenAdmin, http().post('/api/clientes'))
      .send({ nombre: `Señora Rosa ${sufijo}`, dni, limiteCredito: 20 })
      .expect(201);
    const rosa = res.body as Cliente;
    idRosa = rosa.id;
    expect(Number(rosa.deuda)).toBe(0);
    expect(Number(rosa.creditoDisponible)).toBe(20);
  });

  it('no permite DNI repetido (409)', () =>
    con(tokenAdmin, http().post('/api/clientes'))
      .send({ nombre: `Otra ${sufijo}`, dni })
      .expect(409));

  it('valida DNI y celular (400)', async () => {
    await con(tokenAdmin, http().post('/api/clientes'))
      .send({ nombre: `Malo ${sufijo}`, dni: '123' })
      .expect(400);
    await con(tokenAdmin, http().post('/api/clientes'))
      .send({ nombre: `Malo ${sufijo}`, telefono: '012345678' })
      .expect(400);
  });

  it('busca clientes por DNI', async () => {
    const res = await con(tokenCajero, http().get('/api/clientes'))
      .query({ buscar: dni })
      .expect(200);
    expect((res.body as Cliente[]).map((c) => c.id)).toEqual([idRosa]);
  });

  it('busca clientes por nombre sin importar tildes ni mayúsculas', async () => {
    const res = await con(tokenCajero, http().get('/api/clientes'))
      .query({ buscar: `SENORA rosa ${sufijo}` })
      .expect(200);
    expect((res.body as Cliente[]).map((c) => c.id)).toEqual([idRosa]);
  });

  // ---------------- Fiado ----------------

  it('fía S/ 10 y la deuda se actualiza', async () => {
    const res = await fiar(2).expect(201);
    idVenta10 = (res.body as { id: number }).id;
    expect(await deudaDe(idRosa)).toBe(10);
  });

  it('aparece en la lista de deudores', async () => {
    const res = await con(tokenCajero, http().get('/api/clientes'))
      .query({ soloDeudores: true })
      .expect(200);
    const rosa = (res.body as Cliente[]).find((c) => c.id === idRosa);
    expect(Number(rosa?.deuda)).toBe(10);
    expect(Number(rosa?.creditoDisponible)).toBe(10);
  });

  it('dos fiados simultáneos de S/ 10 con solo S/ 10 disponibles: solo pasa uno', async () => {
    const [a, b] = await Promise.all([fiar(2), fiar(2)]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    expect(await deudaDe(idRosa)).toBe(20); // nunca supera el límite
    // Se anula el que pasó para seguir con S/ 10 de deuda
    const ganadora = (a.status === 201 ? a : b).body as { id: number };
    await con(tokenCajero, http().post(`/api/ventas/${ganadora.id}/anular`))
      .send({ motivo: 'prueba de concurrencia' })
      .expect(200);
    expect(await deudaDe(idRosa)).toBe(10);
  });

  it('fía S/ 5 más (deuda S/ 15)', async () => {
    const res = await fiar(1).expect(201);
    idVenta6 = (res.body as { id: number }).id;
    expect(await deudaDe(idRosa)).toBe(15);
  });

  // ---------------- Pagos ----------------

  it('no se puede cobrar sin caja abierta (400)', () =>
    con(tokenSinCaja, http().post(`/api/clientes/${idRosa}/pagos`))
      .send({ monto: 5 })
      .expect(400));

  it('no se puede cobrar más de lo que debe (400)', () =>
    con(tokenCajero, http().post(`/api/clientes/${idRosa}/pagos`))
      .send({ monto: 15.5 })
      .expect(400));

  it('cobra S/ 7.50 a cuenta y entra al efectivo de la caja', async () => {
    const antes = await con(tokenCajero, http().get('/api/caja/actual'));
    const efectivoAntes = Number(
      (antes.body as { resumen: { efectivoEsperado: string } }).resumen
        .efectivoEsperado,
    );

    const res = await con(
      tokenCajero,
      http().post(`/api/clientes/${idRosa}/pagos`),
    )
      .send({ monto: 7.5 })
      .expect(201);
    expect(Number((res.body as { deudaRestante: string }).deudaRestante)).toBe(
      7.5,
    );

    const despues = await con(tokenCajero, http().get('/api/caja/actual'));
    const resumen = (
      despues.body as {
        resumen: { efectivoEsperado: string; pagosFiadoRecibidos: string };
      }
    ).resumen;
    expect(Number(resumen.efectivoEsperado)).toBe(efectivoAntes + 7.5);
    expect(Number(resumen.pagosFiadoRecibidos)).toBe(7.5);
  });

  it('el estado de cuenta muestra fiados y pagos con saldo acumulado', async () => {
    const res = await con(
      tokenCajero,
      http().get(`/api/clientes/${idRosa}/estado-cuenta`),
    ).expect(200);
    const body = res.body as {
      movimientos: { tipo: string; saldo: string }[];
    };
    // Fiado 10, fiado 5, pago 7.50 (el fiado anulado no aparece)
    expect(body.movimientos.map((m) => m.tipo)).toEqual([
      'FIADO',
      'FIADO',
      'PAGO',
    ]);
    expect(body.movimientos.map((m) => Number(m.saldo))).toEqual([10, 15, 7.5]);
  });

  // ---------------- Anulación de fiados ----------------

  it('no se puede anular un fiado si la deuda quedaría negativa (409)', async () => {
    // Debe S/ 7.50; anular la venta de S/ 10 dejaría -2.50
    const res = await con(
      tokenCajero,
      http().post(`/api/ventas/${idVenta10}/anular`),
    )
      .send({ motivo: 'prueba' })
      .expect(409);
    expect((res.body as { message: string }).message).toContain(
      'No se puede anular',
    );
  });

  it('sí se puede anular un fiado que no deja deuda negativa', async () => {
    await con(tokenCajero, http().post(`/api/ventas/${idVenta6}/anular`))
      .send({ motivo: 'Devolvió el producto' })
      .expect(200);
    expect(await deudaDe(idRosa)).toBe(2.5);
  });

  // ---------------- Edición ----------------

  it('solo el admin cambia el límite de crédito', async () => {
    await con(tokenCajero, http().patch(`/api/clientes/${idRosa}`))
      .send({ limiteCredito: 100 })
      .expect(403);
    const res = await con(tokenAdmin, http().patch(`/api/clientes/${idRosa}`))
      .send({ limiteCredito: 50, telefono: '912345678' })
      .expect(200);
    expect(Number((res.body as Cliente).creditoDisponible)).toBe(47.5);
  });
});
