import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configurarApp } from './../src/configurar-app';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Pruebas de categorías y productos contra la base de datos del .env.
 * Requisito: migración + seed ejecutados. Todo lo que se crea aquí se borra al final.
 */
describe('Catálogo: categorías y productos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenAdmin: string;
  let tokenCajero: string;
  let idAbarrotes: number;
  const sufijo = Date.now().toString().slice(-6);
  // Producto propio de la prueba: así no dependemos de los datos del seed
  const codigoBase = `778${sufijo}55`;
  const nombreBase = `Quinua Perlada ${sufijo}`;
  const usuarioCajero = `cajero_cat_${sufijo}`;

  type Producto = {
    id: number;
    nombre: string;
    precioVenta: string;
    stock: string;
    stockBajo: boolean;
    categoria: { nombre: string };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configurarApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const login = await http()
      .post('/api/auth/login')
      .send({ usuario: 'admin', password: 'admin123' });
    tokenAdmin = (login.body as { accessToken: string }).accessToken;

    await http()
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Cajero', usuario: usuarioCajero, password: 'caja123' });
    const loginCajero = await http()
      .post('/api/auth/login')
      .send({ usuario: usuarioCajero, password: 'caja123' });
    tokenCajero = (loginCajero.body as { accessToken: string }).accessToken;

    const abarrotes = await prisma.categoria.findFirstOrThrow({
      where: { nombre: 'Abarrotes' },
    });
    idAbarrotes = abarrotes.id;

    await prisma.producto.create({
      data: {
        codigoBarras: codigoBase,
        nombre: nombreBase,
        categoriaId: idAbarrotes,
        precioCompra: 8,
        precioVenta: 10,
        stock: 20,
        stockMinimo: 5,
      },
    });
  });

  afterAll(async () => {
    const productos = await prisma.producto.findMany({
      where: { nombre: { contains: sufijo } },
      select: { id: true },
    });
    const ids = productos.map((p) => p.id);
    await prisma.movimientoInventario.deleteMany({
      where: { productoId: { in: ids } },
    });
    await prisma.producto.deleteMany({ where: { id: { in: ids } } });
    await prisma.categoria.deleteMany({
      where: { nombre: { contains: sufijo } },
    });
    await prisma.usuario.deleteMany({ where: { usuario: usuarioCajero } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const comoAdmin = (r: request.Test) =>
    r.set('Authorization', `Bearer ${tokenAdmin}`);
  const comoCajero = (r: request.Test) =>
    r.set('Authorization', `Bearer ${tokenCajero}`);

  // ---------------- Categorías ----------------

  it('lista categorías con su cantidad de productos', async () => {
    const res = await comoCajero(http().get('/api/categorias')).expect(200);
    const abarrotes = (
      res.body as { nombre: string; cantidadProductos: number }[]
    ).find((c) => c.nombre === 'Abarrotes');
    expect(abarrotes?.cantidadProductos).toBeGreaterThan(0);
  });

  it('no permite categorías repetidas aunque cambien las mayúsculas (409)', () =>
    comoAdmin(http().post('/api/categorias'))
      .send({ nombre: 'bebidas' })
      .expect(409));

  it('crea y elimina una categoría vacía', async () => {
    const res = await comoAdmin(http().post('/api/categorias'))
      .send({ nombre: `Prueba ${sufijo}` })
      .expect(201);
    const id = (res.body as { id: number }).id;
    await comoAdmin(http().delete(`/api/categorias/${id}`)).expect(200);
  });

  it('no elimina una categoría con productos (409)', () =>
    comoAdmin(http().delete(`/api/categorias/${idAbarrotes}`)).expect(409));

  it('el cajero no puede crear categorías (403)', () =>
    comoCajero(http().post('/api/categorias'))
      .send({ nombre: `Cajero ${sufijo}` })
      .expect(403));

  // ---------------- Productos: consulta ----------------

  it('busca productos por nombre parcial sin importar mayúsculas', async () => {
    const res = await comoCajero(
      http().get('/api/productos').query({ buscar: nombreBase.toUpperCase() }),
    ).expect(200);
    const body = res.body as { datos: Producto[]; total: number };
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.datos[0].categoria.nombre).toBe('Abarrotes');
    // Los montos viajan como texto para no perder precisión
    expect(typeof body.datos[0].precioVenta).toBe('string');
  });

  it('busca sin importar las tildes ("limon" encuentra "Limón")', async () => {
    await comoAdmin(http().post('/api/productos'))
      .send({
        nombre: `Limón sutil ${sufijo}`,
        categoriaId: idAbarrotes,
        unidad: 'KG',
        precioCompra: 5,
        precioVenta: 7,
      })
      .expect(201);
    const res = await comoCajero(
      http()
        .get('/api/productos')
        .query({ buscar: `limon SUTIL ${sufijo}` }),
    ).expect(200);
    expect(
      (res.body as { datos: Producto[] }).datos.map((p) => p.nombre),
    ).toEqual([`Limón sutil ${sufijo}`]);
  });

  it('los signos % y _ se buscan como texto, no como comodines', async () => {
    const res = await comoCajero(
      http().get('/api/productos').query({ buscar: '%_%' }),
    ).expect(200);
    expect((res.body as { total: number }).total).toBe(0);
  });

  it('el lector de la caja encuentra un producto por código de barras', async () => {
    const res = await comoCajero(
      http().get(`/api/productos/codigo/${codigoBase}`),
    ).expect(200);
    expect((res.body as Producto).nombre).toBe(nombreBase);
  });

  it('responde 404 si el código no existe', () =>
    comoCajero(http().get('/api/productos/codigo/0000000000')).expect(404));

  // ---------------- Productos: creación y reglas ----------------

  it('crea un producto con stock inicial y registra su movimiento de ENTRADA', async () => {
    const res = await comoAdmin(http().post('/api/productos'))
      .send({
        codigoBarras: `775${sufijo}01`,
        nombre: `Fideos Don Vittorio ${sufijo}`,
        categoriaId: idAbarrotes,
        precioCompra: 2.8,
        precioVenta: 3.5,
        stockInicial: 10,
        stockMinimo: 3,
      })
      .expect(201);
    const producto = res.body as Producto;
    expect(producto.stock).toBe('10');

    const movimientos = await prisma.movimientoInventario.findMany({
      where: { productoId: producto.id },
    });
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0].tipo).toBe('ENTRADA');
  });

  it('acepta stock fraccionado en productos a granel (KG)', () =>
    comoAdmin(http().post('/api/productos'))
      .send({
        nombre: `Lentejas a granel ${sufijo}`,
        categoriaId: idAbarrotes,
        unidad: 'KG',
        precioCompra: 6,
        precioVenta: 7.5,
        stockInicial: 2.5,
      })
      .expect(201));

  it('rechaza stock fraccionado en productos por unidad (400)', () =>
    comoAdmin(http().post('/api/productos'))
      .send({
        nombre: `Lata atún ${sufijo}`,
        categoriaId: idAbarrotes,
        precioCompra: 5,
        precioVenta: 6,
        stockInicial: 2.5,
      })
      .expect(400));

  it('rechaza precio de venta menor al de compra (400)', () =>
    comoAdmin(http().post('/api/productos'))
      .send({
        nombre: `Producto a pérdida ${sufijo}`,
        categoriaId: idAbarrotes,
        precioCompra: 5,
        precioVenta: 4,
      })
      .expect(400));

  it('rechaza un código de barras ya usado (409)', () =>
    comoAdmin(http().post('/api/productos'))
      .send({
        codigoBarras: codigoBase,
        nombre: `Código duplicado ${sufijo}`,
        categoriaId: idAbarrotes,
        precioCompra: 3,
        precioVenta: 4,
      })
      .expect(409));

  it('el cajero no puede crear productos (403)', () =>
    comoCajero(http().post('/api/productos'))
      .send({
        nombre: `Del cajero ${sufijo}`,
        categoriaId: idAbarrotes,
        precioCompra: 1,
        precioVenta: 2,
      })
      .expect(403));

  // ---------------- Productos: edición y stock bajo ----------------

  it('no permite editar el stock directamente (400)', async () => {
    const lista = await comoAdmin(
      http()
        .get('/api/productos')
        .query({ buscar: `Fideos Don Vittorio ${sufijo}` }),
    );
    const id = (lista.body as { datos: Producto[] }).datos[0].id;
    await comoAdmin(http().patch(`/api/productos/${id}`))
      .send({ stock: 999 })
      .expect(400);
  });

  it('al subir el stock mínimo, el producto aparece en stock bajo', async () => {
    const lista = await comoAdmin(
      http()
        .get('/api/productos')
        .query({ buscar: `Fideos Don Vittorio ${sufijo}` }),
    );
    const id = (lista.body as { datos: Producto[] }).datos[0].id;

    const editado = await comoAdmin(http().patch(`/api/productos/${id}`))
      .send({ stockMinimo: 12, precioVenta: 3.8 })
      .expect(200);
    expect((editado.body as Producto).stockBajo).toBe(true);

    const bajo = await comoCajero(
      http().get('/api/productos/stock-bajo'),
    ).expect(200);
    expect((bajo.body as Producto[]).some((p) => p.id === id)).toBe(true);
  });

  it('un producto desactivado ya no aparece en la búsqueda normal', async () => {
    const lista = await comoAdmin(
      http()
        .get('/api/productos')
        .query({ buscar: `Lentejas a granel ${sufijo}` }),
    );
    const id = (lista.body as { datos: Producto[] }).datos[0].id;
    await comoAdmin(http().patch(`/api/productos/${id}`))
      .send({ activo: false })
      .expect(200);

    const activos = await comoCajero(
      http()
        .get('/api/productos')
        .query({ buscar: `Lentejas a granel ${sufijo}` }),
    );
    expect((activos.body as { total: number }).total).toBe(0);

    const todos = await comoAdmin(
      http()
        .get('/api/productos')
        .query({
          buscar: `Lentejas a granel ${sufijo}`,
          incluirInactivos: true,
        }),
    );
    expect((todos.body as { total: number }).total).toBe(1);
  });
});
