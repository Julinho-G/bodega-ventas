import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarApp } from './../src/configurar-app';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Pruebas de caja y ventas contra la base de datos del .env.
 * Crea sus propios cajeros, productos y cliente, y los borra al final.
 */
describe('Caja y ventas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const sufijo = Date.now().toString().slice(-6);

  let tokenAdmin: string;
  let tokenCajero1: string;
  let tokenCajero2: string;
  let idArroz: number; // UND a S/ 2.50, stock 20
  let idAzucar: number; // KG a S/ 4.50, stock 10
  let idUltimo: number; // UND, stock 1 (para la prueba de concurrencia)
  let idCliente: number; // límite de crédito S/ 5.00
  let idVentaEfectivo: number;
  let idVentaYape: number;

  type Venta = {
    id: number;
    total: string;
    vuelto: string | null;
    estado: string;
    detalles: { precioUnitario: string; subtotal: string }[];
  };
  type Resumen = {
    efectivoEsperado: string;
    totalVendido: string;
    cantidadVentas: number;
    ventasAnuladas: number;
    ventasPorMetodo: { metodo: string; total: string; cantidad: number }[];
  };

  const http = () => request(app.getHttpServer());
  const con = (token: string, r: request.Test) =>
    r.set('Authorization', `Bearer ${token}`);
  const stock = async (id: number) =>
    (
      await prisma.producto.findUniqueOrThrow({ where: { id } })
    ).stock.toNumber();

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
    for (const n of [1, 2]) {
      await con(tokenAdmin, http().post('/api/usuarios')).send({
        nombre: `Cajero ${n}`,
        usuario: `caja${n}_${sufijo}`,
        password: 'caja123',
      });
    }
    tokenCajero1 = await login(`caja1_${sufijo}`, 'caja123');
    tokenCajero2 = await login(`caja2_${sufijo}`, 'caja123');

    const categoria = await prisma.categoria.findFirstOrThrow();
    const crear = (
      nombre: string,
      unidad: 'UND' | 'KG',
      precio: number,
      st: number,
    ) =>
      prisma.producto.create({
        data: {
          nombre: `${nombre} ${sufijo}`,
          categoriaId: categoria.id,
          unidad,
          precioCompra: precio - 0.5,
          precioVenta: precio,
          stock: st,
        },
      });
    idArroz = (await crear('Arroz prueba', 'UND', 2.5, 20)).id;
    idAzucar = (await crear('Azúcar prueba', 'KG', 4.5, 10)).id;
    idUltimo = (await crear('Último paquete', 'UND', 3, 1)).id;
    idCliente = (
      await prisma.cliente.create({
        data: { nombre: `Vecina ${sufijo}`, limiteCredito: 5 },
      })
    ).id;
  });

  afterAll(async () => {
    const usuarios = await prisma.usuario.findMany({
      where: { usuario: { endsWith: `_${sufijo}` } },
    });
    const idsUsuarios = usuarios.map((u) => u.id);
    const idsProductos = [idArroz, idAzucar, idUltimo];
    const ventas = await prisma.venta.findMany({
      where: {
        OR: [
          { usuarioId: { in: idsUsuarios } },
          { detalles: { some: { productoId: { in: idsProductos } } } },
        ],
      },
    });
    const idsVentas = ventas.map((v) => v.id);

    await prisma.movimientoInventario.deleteMany({
      where: {
        OR: [
          { productoId: { in: idsProductos } },
          { ventaId: { in: idsVentas } },
        ],
      },
    });
    await prisma.venta.deleteMany({ where: { id: { in: idsVentas } } }); // detalle en cascada
    await prisma.pagoFiado.deleteMany({ where: { clienteId: idCliente } });
    await prisma.turnoCaja.deleteMany({
      where: { usuarioId: { in: idsUsuarios } },
    });
    await prisma.producto.deleteMany({ where: { id: { in: idsProductos } } });
    await prisma.cliente.deleteMany({ where: { id: idCliente } });
    await prisma.usuario.deleteMany({ where: { id: { in: idsUsuarios } } });
    await app.close();
  });

  // ---------------- Apertura de caja ----------------

  it('no se puede vender sin abrir la caja (400)', () =>
    con(tokenCajero1, http().post('/api/ventas'))
      .send({
        items: [{ productoId: idArroz, cantidad: 1 }],
        metodoPago: 'EFECTIVO',
      })
      .expect(400));

  it('abre la caja con S/ 100 de sencillo', () =>
    con(tokenCajero1, http().post('/api/caja/abrir'))
      .send({ montoInicial: 100 })
      .expect(201));

  it('no permite abrir dos turnos a la vez (409)', () =>
    con(tokenCajero1, http().post('/api/caja/abrir'))
      .send({ montoInicial: 50 })
      .expect(409));

  // ---------------- Venta correcta ----------------

  it('registra una venta en efectivo con producto a granel y calcula el vuelto', async () => {
    const res = await con(tokenCajero1, http().post('/api/ventas'))
      .send({
        items: [
          { productoId: idArroz, cantidad: 2 }, // 2 × 2.50 = 5.00
          { productoId: idAzucar, cantidad: 0.333 }, // 0.333 × 4.50 = 1.4985 → 1.50
        ],
        metodoPago: 'EFECTIVO',
        montoRecibido: 10,
      })
      .expect(201);

    const venta = res.body as Venta;
    idVentaEfectivo = venta.id;
    expect(Number(venta.total)).toBe(6.5);
    expect(Number(venta.vuelto)).toBe(3.5);
    expect(venta.detalles.map((d) => Number(d.subtotal))).toEqual([5, 1.5]);

    // El stock bajó y quedó registrado el movimiento
    expect(await stock(idArroz)).toBe(18);
    expect(await stock(idAzucar)).toBe(9.667);
    const movimientos = await prisma.movimientoInventario.findMany({
      where: { ventaId: venta.id },
    });
    expect(movimientos).toHaveLength(2);
    expect(
      movimientos.every((m) => m.tipo === 'VENTA' && m.cantidad.isNegative()),
    ).toBe(true);
  });

  it('registra una venta por Yape', async () => {
    const res = await con(tokenCajero1, http().post('/api/ventas'))
      .send({
        items: [{ productoId: idArroz, cantidad: 1 }],
        metodoPago: 'YAPE',
      })
      .expect(201);
    idVentaYape = (res.body as Venta).id;
  });

  // ---------------- Validaciones ----------------

  it('rechaza la venta si falta stock y NO cambia nada (transacción)', async () => {
    const ventasAntes = await prisma.venta.count();
    await con(tokenCajero1, http().post('/api/ventas'))
      .send({
        items: [
          { productoId: idArroz, cantidad: 1 }, // este sí alcanza...
          { productoId: idAzucar, cantidad: 50 }, // ...pero este no
        ],
        metodoPago: 'EFECTIVO',
      })
      .expect(400);
    expect(await stock(idArroz)).toBe(17); // no se descontó el arroz
    expect(await prisma.venta.count()).toBe(ventasAntes);
  });

  it('rechaza cantidades fraccionadas en productos por unidad (400)', () =>
    con(tokenCajero1, http().post('/api/ventas'))
      .send({
        items: [{ productoId: idArroz, cantidad: 1.5 }],
        metodoPago: 'EFECTIVO',
      })
      .expect(400));

  it('rechaza productos repetidos en la misma venta (400)', () =>
    con(tokenCajero1, http().post('/api/ventas'))
      .send({
        items: [
          { productoId: idArroz, cantidad: 1 },
          { productoId: idArroz, cantidad: 1 },
        ],
        metodoPago: 'EFECTIVO',
      })
      .expect(400));

  it('rechaza un monto recibido menor al total (400)', () =>
    con(tokenCajero1, http().post('/api/ventas'))
      .send({
        items: [{ productoId: idArroz, cantidad: 2 }],
        metodoPago: 'EFECTIVO',
        montoRecibido: 3,
      })
      .expect(400));

  // ---------------- Fiado ----------------

  it('el fiado exige cliente (400)', () =>
    con(tokenCajero1, http().post('/api/ventas'))
      .send({
        items: [{ productoId: idArroz, cantidad: 1 }],
        metodoPago: 'FIADO',
      })
      .expect(400));

  it('fía dentro del límite y rechaza cuando se supera', async () => {
    await con(tokenCajero1, http().post('/api/ventas'))
      .send({
        items: [{ productoId: idArroz, cantidad: 1 }], // S/ 2.50 de S/ 5.00
        metodoPago: 'FIADO',
        clienteId: idCliente,
      })
      .expect(201);

    const res = await con(tokenCajero1, http().post('/api/ventas'))
      .send({
        items: [{ productoId: idArroz, cantidad: 2 }], // S/ 5.00 > S/ 2.50 disponible
        metodoPago: 'FIADO',
        clienteId: idCliente,
      })
      .expect(400);
    expect((res.body as { message: string }).message).toContain(
      'Crédito insuficiente',
    );
  });

  // ---------------- Precio histórico ----------------

  it('la venta conserva el precio del momento aunque luego suba', async () => {
    await con(tokenAdmin, http().patch(`/api/productos/${idArroz}`))
      .send({ precioVenta: 3 })
      .expect(200);
    const res = await con(
      tokenCajero1,
      http().get(`/api/ventas/${idVentaEfectivo}`),
    ).expect(200);
    expect(Number((res.body as Venta).detalles[0].precioUnitario)).toBe(2.5);
  });

  // ---------------- Concurrencia ----------------

  it('si dos cajas venden el último producto a la vez, solo una lo logra', async () => {
    await con(tokenCajero2, http().post('/api/caja/abrir'))
      .send({ montoInicial: 0 })
      .expect(201);

    const venta = {
      items: [{ productoId: idUltimo, cantidad: 1 }],
      metodoPago: 'EFECTIVO',
    };
    const [a, b] = await Promise.all([
      con(tokenCajero1, http().post('/api/ventas')).send(venta),
      con(tokenCajero2, http().post('/api/ventas')).send(venta),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    expect(await stock(idUltimo)).toBe(0); // nunca negativo
  });

  // ---------------- Permisos y anulación ----------------

  it('un cajero no puede ver ni anular ventas de otro (403)', async () => {
    await con(tokenCajero2, http().get(`/api/ventas/${idVentaYape}`)).expect(
      403,
    );
    await con(tokenCajero2, http().post(`/api/ventas/${idVentaYape}/anular`))
      .send({ motivo: 'prueba' })
      .expect(403);
  });

  it('anular exige motivo (400)', () =>
    con(tokenCajero1, http().post(`/api/ventas/${idVentaYape}/anular`))
      .send({})
      .expect(400));

  it('el cajero anula su venta: vuelve el stock y no se puede anular dos veces', async () => {
    const antes = await stock(idArroz);
    const res = await con(
      tokenCajero1,
      http().post(`/api/ventas/${idVentaYape}/anular`),
    )
      .send({ motivo: 'El cliente se arrepintió' })
      .expect(200);
    expect((res.body as Venta).estado).toBe('ANULADA');
    expect(await stock(idArroz)).toBe(antes + 1);

    await con(tokenCajero1, http().post(`/api/ventas/${idVentaYape}/anular`))
      .send({ motivo: 'otra vez' })
      .expect(409);
  });

  // ---------------- Cuadre y cierre ----------------

  it('el resumen cuadra: inicial + efectivo; Yape anulado y fiado no suman al cajón', async () => {
    const res = await con(tokenCajero1, http().get('/api/caja/actual')).expect(
      200,
    );
    const resumen = (res.body as { resumen: Resumen }).resumen;
    // 100 inicial + 6.50 efectivo (+3.00 si ganó la carrera del último paquete)
    const efectivo = Number(
      resumen.ventasPorMetodo.find((v) => v.metodo === 'EFECTIVO')!.total,
    );
    expect(Number(resumen.efectivoEsperado)).toBe(100 + efectivo);
    expect(resumen.ventasAnuladas).toBe(1);
    expect(
      Number(resumen.ventasPorMetodo.find((v) => v.metodo === 'YAPE')!.total),
    ).toBe(0);
    expect(
      Number(resumen.ventasPorMetodo.find((v) => v.metodo === 'FIADO')!.total),
    ).toBe(2.5);
  });

  it('cierra la caja y calcula la diferencia (falta S/ 1.00)', async () => {
    const actual = await con(tokenCajero1, http().get('/api/caja/actual'));
    const esperado = Number(
      (actual.body as { resumen: Resumen }).resumen.efectivoEsperado,
    );
    const res = await con(tokenCajero1, http().post('/api/caja/cerrar'))
      .send({ montoContado: esperado - 1 })
      .expect(200);
    expect(Number((res.body as { diferencia: string }).diferencia)).toBe(-1);
  });

  it('con la caja cerrada, GET /caja/actual responde 200 con turno null (no es un error)', async () => {
    const res = await con(tokenCajero1, http().get('/api/caja/actual')).expect(
      200,
    );
    expect(res.body).toEqual({ turno: null, resumen: null });
  });

  it('con la caja cerrada no se vende, y el cajero ya no puede anular esa venta', async () => {
    await con(tokenCajero1, http().post('/api/ventas'))
      .send({
        items: [{ productoId: idArroz, cantidad: 1 }],
        metodoPago: 'EFECTIVO',
      })
      .expect(400);
    await con(
      tokenCajero1,
      http().post(`/api/ventas/${idVentaEfectivo}/anular`),
    )
      .send({ motivo: 'tarde' })
      .expect(403);
  });

  it('el administrador sí puede anular una venta de un turno cerrado', () =>
    con(tokenAdmin, http().post(`/api/ventas/${idVentaEfectivo}/anular`))
      .send({ motivo: 'Corrección autorizada' })
      .expect(200));

  it('solo el administrador ve el historial de turnos', async () => {
    await con(tokenCajero1, http().get('/api/caja/turnos')).expect(403);
    await con(tokenAdmin, http().get('/api/caja/turnos')).expect(200);
  });
});
