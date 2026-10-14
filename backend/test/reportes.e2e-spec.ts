import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarApp } from './../src/configurar-app';
import { hoyEnLima } from './../src/common/fechas';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Pruebas de reportes contra la base de datos del .env.
 * La base puede tener ventas reales del día, así que se compara el reporte
 * ANTES y DESPUÉS de registrar ventas conocidas (diferencias exactas).
 */
describe('Reportes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const sufijo = Date.now().toString().slice(-6);
  const hoy = hoyEnLima();

  let tokenAdmin: string;
  let tokenCajero: string;
  let idCategoria: number;
  let idChocolate: number; // UND: costo 2.00, venta 3.50
  let idQueso: number; // KG: costo 3.00, venta 4.50
  let antes: Resumen;
  let despues: Resumen;

  type Resumen = {
    cantidadVentas: number;
    totalVendido: string;
    costoDeVentas: string;
    gananciaBruta: string;
    anuladas: { cantidad: number; monto: string };
    porMetodoPago: { metodo: string; total: string }[];
    porDia: { dia: string; total: string }[];
    porHora: { hora: number; ventas: number }[];
  };

  const http = () => request(app.getHttpServer());
  const con = (token: string, r: request.Test) =>
    r.set('Authorization', `Bearer ${token}`);
  const resumen = async () =>
    (await con(tokenAdmin, http().get('/api/reportes/resumen')).expect(200))
      .body as Resumen;
  const n = (v: string | undefined) => Number(v ?? 0);
  const delta = (campo: 'totalVendido' | 'costoDeVentas' | 'gananciaBruta') =>
    Math.round((n(despues[campo]) - n(antes[campo])) * 100) / 100;

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
      nombre: 'Cajero reportes',
      usuario: `rep_${sufijo}`,
      password: 'caja123',
    });
    tokenCajero = await login(`rep_${sufijo}`, 'caja123');

    // Categoría propia: así el inventario valorizado de esta categoría es exacto
    idCategoria = (
      await prisma.categoria.create({ data: { nombre: `Reportes ${sufijo}` } })
    ).id;
    const crear = async (body: object) =>
      (
        (
          await con(tokenAdmin, http().post('/api/productos'))
            .send({ categoriaId: idCategoria, ...body })
            .expect(201)
        ).body as { id: number }
      ).id;
    idChocolate = await crear({
      nombre: `Chocolate ${sufijo}`,
      precioCompra: 2,
      precioVenta: 3.5,
      stockInicial: 20,
      stockMinimo: 18,
    });
    idQueso = await crear({
      nombre: `Queso fresco ${sufijo}`,
      unidad: 'KG',
      precioCompra: 3,
      precioVenta: 4.5,
      stockInicial: 2,
    });

    antes = await resumen();

    await con(tokenCajero, http().post('/api/caja/abrir'))
      .send({ montoInicial: 0 })
      .expect(201);
    const vender = (body: object) =>
      con(tokenCajero, http().post('/api/ventas')).send(body).expect(201);

    // Venta 1 (efectivo): 4 chocolates = 14.00 | costo 8.00 | ganancia 6.00
    await vender({
      items: [{ productoId: idChocolate, cantidad: 4 }],
      metodoPago: 'EFECTIVO',
    });
    // Venta 2 (Yape): 0.5 kg de queso = 2.25 | costo 1.50 | ganancia 0.75
    await vender({
      items: [{ productoId: idQueso, cantidad: 0.5 }],
      metodoPago: 'YAPE',
    });
    // Venta 3: se anula, no debe sumar
    const anulada = await vender({
      items: [{ productoId: idChocolate, cantidad: 1 }],
      metodoPago: 'EFECTIVO',
    });
    await con(
      tokenCajero,
      http().post(`/api/ventas/${(anulada.body as { id: number }).id}/anular`),
    )
      .send({ motivo: 'Prueba de reporte' })
      .expect(200);

    // Luego el costo del chocolate sube: NO debe cambiar la ganancia ya registrada
    await con(tokenAdmin, http().post('/api/inventario/ingresos'))
      .send({
        items: [{ productoId: idChocolate, cantidad: 1, precioCompra: 3 }],
      })
      .expect(201);

    despues = await resumen();
  });

  afterAll(async () => {
    const cajero = await prisma.usuario.findUnique({
      where: { usuario: `rep_${sufijo}` },
    });
    const ids = [idChocolate, idQueso];
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
    await prisma.categoria.deleteMany({ where: { id: idCategoria } });
    await app.close();
  });

  // ---------------- Resumen ----------------

  it('suma las ventas pagadas del día con su costo y ganancia', () => {
    expect(despues.cantidadVentas - antes.cantidadVentas).toBe(2);
    expect(delta('totalVendido')).toBe(16.25);
    expect(delta('costoDeVentas')).toBe(9.5);
    expect(delta('gananciaBruta')).toBe(6.75);
  });

  it('la ganancia usa el costo del momento de la venta (no cambia si el costo sube)', async () => {
    // El ingreso con costo 3.00 fue DESPUÉS de vender: el costo registrado sigue en 8.00
    const detalle = await prisma.detalleVenta.findFirstOrThrow({
      where: { productoId: idChocolate, venta: { estado: 'PAGADA' } },
    });
    expect(detalle.costoUnitario.toNumber()).toBe(2);
    expect(delta('gananciaBruta')).toBe(6.75);
  });

  it('las ventas anuladas no suman, pero se informan aparte', () => {
    expect(despues.anuladas.cantidad - antes.anuladas.cantidad).toBe(1);
    expect(
      Math.round((n(despues.anuladas.monto) - n(antes.anuladas.monto)) * 100) /
        100,
    ).toBe(3.5);
  });

  it('desglosa por método de pago, por día y por hora de Lima', () => {
    const metodo = (r: Resumen, m: string) =>
      n(r.porMetodoPago.find((x) => x.metodo === m)?.total);
    expect(metodo(despues, 'EFECTIVO') - metodo(antes, 'EFECTIVO')).toBe(14);
    expect(metodo(despues, 'YAPE') - metodo(antes, 'YAPE')).toBe(2.25);

    const dia = (r: Resumen) => n(r.porDia.find((d) => d.dia === hoy)?.total);
    expect(Math.round((dia(despues) - dia(antes)) * 100) / 100).toBe(16.25);

    const ventasPorHora = (r: Resumen) =>
      r.porHora.reduce((acc, h) => acc + h.ventas, 0);
    expect(ventasPorHora(despues) - ventasPorHora(antes)).toBe(2);
    expect(despues.porHora.every((h) => h.hora >= 0 && h.hora <= 23)).toBe(
      true,
    );
  });

  // ---------------- Productos más vendidos ----------------

  it('el ranking por ganancia incluye los productos con cifras exactas', async () => {
    const res = await con(tokenAdmin, http().get('/api/reportes/productos'))
      .query({ orden: 'ganancia', limite: 100 })
      .expect(200);
    const productos = (
      res.body as {
        productos: {
          id: number;
          ventas: number;
          cantidad: string;
          importe: string;
          ganancia: string;
        }[];
      }
    ).productos;
    const chocolate = productos.find((p) => p.id === idChocolate);
    const queso = productos.find((p) => p.id === idQueso);
    expect(chocolate).toMatchObject({ ventas: 1 }); // la anulada no cuenta
    expect(n(chocolate?.cantidad)).toBe(4);
    expect(n(chocolate?.importe)).toBe(14);
    expect(n(chocolate?.ganancia)).toBe(6);
    expect(n(queso?.cantidad)).toBe(0.5);
    expect(n(queso?.ganancia)).toBe(0.75);
    // Ordenado de mayor a menor ganancia
    const ganancias = productos.map((p) => n(p.ganancia));
    expect([...ganancias].sort((a, b) => b - a)).toEqual(ganancias);
  });

  // ---------------- Inventario valorizado ----------------

  it('valoriza el inventario de la categoría al costo y a precio de venta', async () => {
    const res = await con(
      tokenAdmin,
      http().get('/api/reportes/inventario'),
    ).expect(200);
    const categoria = (
      res.body as {
        categorias: {
          categoria: string;
          productos: number;
          stockBajo: number;
          valorCosto: string;
          valorVenta: string;
          gananciaPotencial: string;
        }[];
      }
    ).categorias.find((c) => c.categoria === `Reportes ${sufijo}`);
    // Chocolate: 20 − 4 vendidos + 1 ingreso = 17 (costo 3.00, venta 3.50)
    // Queso: 2 − 0.5 = 1.5 kg (costo 3.00, venta 4.50)
    expect(categoria?.productos).toBe(2);
    expect(categoria?.stockBajo).toBe(1); // chocolate: 17 <= mínimo 18
    expect(n(categoria?.valorCosto)).toBe(55.5); // 51.00 + 4.50
    expect(n(categoria?.valorVenta)).toBe(66.25); // 59.50 + 6.75
    expect(n(categoria?.gananciaPotencial)).toBe(10.75);
  });

  // ---------------- Validaciones y permisos ----------------

  it('un periodo futuro no tiene ventas', async () => {
    const res = await con(tokenAdmin, http().get('/api/reportes/resumen'))
      .query({ desde: '2099-01-01', hasta: '2099-01-31' })
      .expect(200);
    expect((res.body as Resumen).cantidadVentas).toBe(0);
  });

  it('valida el periodo (400)', async () => {
    await con(tokenAdmin, http().get('/api/reportes/resumen'))
      .query({ desde: '2026-10-20', hasta: '2026-10-01' })
      .expect(400);
    await con(tokenAdmin, http().get('/api/reportes/resumen'))
      .query({ desde: '2024-01-01', hasta: '2026-01-01' })
      .expect(400);
    await con(tokenAdmin, http().get('/api/reportes/productos'))
      .query({ orden: 'precio' })
      .expect(400);
  });

  it('el cajero no ve reportes (403)', () =>
    con(tokenCajero, http().get('/api/reportes/resumen')).expect(403));
});
