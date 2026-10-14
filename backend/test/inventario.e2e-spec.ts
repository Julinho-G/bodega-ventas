import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarApp } from './../src/configurar-app';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Pruebas de inventario contra la base de datos del .env.
 * Crea sus propios productos y cajero, y los borra al final.
 */
describe('Inventario (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const sufijo = Date.now().toString().slice(-6);

  let tokenAdmin: string;
  let tokenCajero: string;
  let idGaseosa: number; // UND, costo 1.90, venta 2.50
  let idHarina: number; // KG, costo 3.00, venta 4.00

  type Kardex = {
    saldoInicial: string;
    saldoFinal: string;
    cuadra: boolean;
    producto: { stockActual: string };
    movimientos: {
      tipo: string;
      entrada: string;
      salida: string;
      saldo: string;
    }[];
  };

  const http = () => request(app.getHttpServer());
  const con = (token: string, r: request.Test) =>
    r.set('Authorization', `Bearer ${token}`);
  const producto = (id: number) =>
    prisma.producto.findUniqueOrThrow({ where: { id } });
  const kardex = async (id: number, query: Record<string, string> = {}) =>
    (
      await con(tokenCajero, http().get(`/api/inventario/kardex/${id}`))
        .query(query)
        .expect(200)
    ).body as Kardex;

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
    await con(tokenAdmin, http().post('/api/usuarios')).send({
      nombre: 'Cajero inventario',
      usuario: `inv_${sufijo}`,
      password: 'caja123',
    });
    tokenCajero = await login(`inv_${sufijo}`, 'caja123');

    // Se crean por la API para que el stock inicial quede como movimiento ENTRADA
    const categoria = await prisma.categoria.findFirstOrThrow();
    const crear = async (body: object) =>
      (
        (
          await con(tokenAdmin, http().post('/api/productos'))
            .send({ categoriaId: categoria.id, ...body })
            .expect(201)
        ).body as { id: number }
      ).id;
    idGaseosa = await crear({
      nombre: `Gaseosa prueba ${sufijo}`,
      precioCompra: 1.9,
      precioVenta: 2.5,
      stockInicial: 10,
    });
    idHarina = await crear({
      nombre: `Harina prueba ${sufijo}`,
      unidad: 'KG',
      precioCompra: 3,
      precioVenta: 4,
      stockInicial: 5,
    });
  });

  afterAll(async () => {
    const cajero = await prisma.usuario.findUnique({
      where: { usuario: `inv_${sufijo}` },
    });
    const ids = [idGaseosa, idHarina];
    const ventas = await prisma.venta.findMany({
      where: { detalles: { some: { productoId: { in: ids } } } },
    });
    await prisma.movimientoInventario.deleteMany({
      where: { productoId: { in: ids } },
    });
    await prisma.venta.deleteMany({
      where: { id: { in: ventas.map((v) => v.id) } },
    });
    if (cajero) {
      await prisma.turnoCaja.deleteMany({ where: { usuarioId: cajero.id } });
      await prisma.usuario.delete({ where: { id: cajero.id } });
    }
    await prisma.producto.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  // ---------------- Permisos ----------------

  it('el cajero no puede registrar ingresos, mermas ni ajustes (403)', async () => {
    await con(tokenCajero, http().post('/api/inventario/ingresos'))
      .send({ items: [{ productoId: idGaseosa, cantidad: 1 }] })
      .expect(403);
    await con(tokenCajero, http().post('/api/inventario/mermas'))
      .send({ productoId: idGaseosa, cantidad: 1, motivo: 'x' })
      .expect(403);
    await con(tokenCajero, http().post('/api/inventario/ajustes'))
      .send({ productoId: idGaseosa, stockReal: 1, motivo: 'x' })
      .expect(403);
  });

  // ---------------- Ingreso de mercadería ----------------

  it('registra un ingreso de varios productos y actualiza el costo', async () => {
    const res = await con(tokenAdmin, http().post('/api/inventario/ingresos'))
      .send({
        nota: 'Distribuidora San Martín, factura F001-458',
        items: [
          { productoId: idGaseosa, cantidad: 24, precioCompra: 2 },
          { productoId: idHarina, cantidad: 2.5 },
        ],
      })
      .expect(201);
    expect((res.body as { motivo: string }).motivo).toContain('F001-458');

    const gaseosa = await producto(idGaseosa);
    expect(gaseosa.stock.toNumber()).toBe(34);
    expect(gaseosa.precioCompra.toNumber()).toBe(2);
    expect((await producto(idHarina)).stock.toNumber()).toBe(7.5);
  });

  it('si el nuevo costo supera el precio de venta, rechaza TODO el ingreso', async () => {
    await con(tokenAdmin, http().post('/api/inventario/ingresos'))
      .send({
        items: [
          { productoId: idHarina, cantidad: 1 }, // este estaba bien...
          { productoId: idGaseosa, cantidad: 12, precioCompra: 2.8 }, // ...este no
        ],
      })
      .expect(400);
    // Nada cambió (transacción)
    expect((await producto(idHarina)).stock.toNumber()).toBe(7.5);
    expect((await producto(idGaseosa)).stock.toNumber()).toBe(34);
  });

  it('acepta el nuevo costo si en el mismo ingreso se sube el precio de venta', async () => {
    await con(tokenAdmin, http().post('/api/inventario/ingresos'))
      .send({
        items: [
          {
            productoId: idGaseosa,
            cantidad: 12,
            precioCompra: 2.8,
            precioVenta: 3.5,
          },
        ],
      })
      .expect(201);
    const gaseosa = await producto(idGaseosa);
    expect(gaseosa.stock.toNumber()).toBe(46);
    expect(gaseosa.precioVenta.toNumber()).toBe(3.5);
  });

  it('rechaza cantidades fraccionadas en productos por unidad (400)', () =>
    con(tokenAdmin, http().post('/api/inventario/ingresos'))
      .send({ items: [{ productoId: idGaseosa, cantidad: 1.5 }] })
      .expect(400));

  // ---------------- Mermas ----------------

  it('registra una merma con su motivo', async () => {
    const res = await con(tokenAdmin, http().post('/api/inventario/mermas'))
      .send({ productoId: idGaseosa, cantidad: 2, motivo: 'Botellas rotas' })
      .expect(201);
    expect(Number((res.body as { stockNuevo: string }).stockNuevo)).toBe(44);
  });

  it('la merma exige motivo y no puede superar el stock (400)', async () => {
    await con(tokenAdmin, http().post('/api/inventario/mermas'))
      .send({ productoId: idGaseosa, cantidad: 1 })
      .expect(400);
    await con(tokenAdmin, http().post('/api/inventario/mermas'))
      .send({ productoId: idHarina, cantidad: 50, motivo: 'Gorgojo' })
      .expect(400);
  });

  // ---------------- Ajuste por conteo ----------------

  it('el conteo físico registra el faltante como ajuste', async () => {
    const res = await con(tokenAdmin, http().post('/api/inventario/ajustes'))
      .send({
        productoId: idGaseosa,
        stockReal: 41,
        motivo: 'Inventario mensual',
      })
      .expect(201);
    const body = res.body as { diferencia: string; resultado: string };
    expect(Number(body.diferencia)).toBe(-3);
    expect(body.resultado).toBe('FALTANTE');
    expect((await producto(idGaseosa)).stock.toNumber()).toBe(41);
  });

  it('si el conteo coincide, no hay nada que ajustar (400)', () =>
    con(tokenAdmin, http().post('/api/inventario/ajustes'))
      .send({ productoId: idGaseosa, stockReal: 41, motivo: 'Recontado' })
      .expect(400));

  // ---------------- Kardex ----------------

  it('el kardex muestra cada movimiento con su saldo y cuadra con el stock', async () => {
    // Una venta para que aparezca en el kardex
    await con(tokenCajero, http().post('/api/caja/abrir'))
      .send({ montoInicial: 0 })
      .expect(201);
    await con(tokenCajero, http().post('/api/ventas'))
      .send({
        items: [{ productoId: idGaseosa, cantidad: 1 }],
        metodoPago: 'EFECTIVO',
      })
      .expect(201);

    const k = await kardex(idGaseosa);
    expect(k.movimientos.map((m) => m.tipo)).toEqual([
      'ENTRADA', // stock inicial 10
      'ENTRADA', // ingreso 24
      'ENTRADA', // ingreso 12
      'MERMA', // -2
      'AJUSTE', // -3
      'VENTA', // -1
    ]);
    expect(k.movimientos.map((m) => Number(m.saldo))).toEqual([
      10, 34, 46, 44, 41, 40,
    ]);
    expect(Number(k.movimientos[3].salida)).toBe(2);
    expect(Number(k.saldoFinal)).toBe(40);
    expect(Number(k.producto.stockActual)).toBe(40);
    expect(k.cuadra).toBe(true);
  });

  it('con filtro de fechas futuro, el kardex arranca con el saldo previo', async () => {
    const manana = new Date(Date.now() + 2 * 86400000)
      .toISOString()
      .slice(0, 10);
    const k = await kardex(idGaseosa, { desde: manana });
    expect(k.movimientos).toHaveLength(0);
    expect(Number(k.saldoInicial)).toBe(40);
  });

  it('el admin filtra los movimientos por tipo (mermas)', async () => {
    const res = await con(tokenAdmin, http().get('/api/inventario/movimientos'))
      .query({ tipo: 'MERMA', productoId: idGaseosa })
      .expect(200);
    const body = res.body as { total: number; datos: { motivo: string }[] };
    expect(body.total).toBe(1);
    expect(body.datos[0].motivo).toBe('Botellas rotas');
  });

  it('el cajero no ve el listado general de movimientos (403)', () =>
    con(tokenCajero, http().get('/api/inventario/movimientos')).expect(403));
});
