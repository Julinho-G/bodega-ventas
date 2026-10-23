/** Reportes (solo administrador): las cifras de la pantalla deben ser las mismas que da la API */
import {
  anchoDePagina,
  crearCajero,
  expect,
  ingresar,
  llamar,
  PRODUCTO,
  soles,
  test,
  tokenAdmin,
} from './ayudas.ts';

type Resumen = {
  periodo: { desde: string };
  totalVendido: string;
  gananciaBruta: string;
  margenPorcentaje: string;
  cantidadVentas: number;
  ticketPromedio: string;
  porMetodoPago: { total: string }[];
  porHora: { total: string }[];
};

test('el reporte coincide con la API', async ({ page }) => {
  // Ventas de hoy hechas por un cajero, para que haya datos
  const cajero = await crearCajero('Cajero Reportes');
  await llamar('/caja/abrir', {
    token: cajero.token,
    cuerpo: { montoInicial: 20 },
  });
  await llamar('/ventas', {
    token: cajero.token,
    cuerpo: {
      items: [{ productoId: PRODUCTO.incaKola, cantidad: 2 }],
      metodoPago: 'YAPE',
    },
  });
  await llamar('/ventas', {
    token: cajero.token,
    cuerpo: {
      items: [{ productoId: PRODUCTO.pan, cantidad: 10 }],
      metodoPago: 'EFECTIVO',
    },
  });
  const token = await tokenAdmin();
  const api = await llamar<Resumen>('/reportes/resumen', { token });
  const hoy = api.periodo.desde;
  const main = page.locator('main');

  await test.step('resumen de hoy', async () => {
    await ingresar(page, 'admin', 'admin123');
    await page.click('nav >> text=Reportes');
    await expect(page.getByText(/^Vendido hoy/)).toBeVisible();
    await expect(main.locator('.cifra').first()).toHaveText(
      soles(api.totalVendido),
    );
    const datos = main.locator('dl').first();
    await expect(datos).toContainText(soles(api.gananciaBruta));
    await expect(datos).toContainText(`${Number(api.margenPorcentaje)} %`);
    await expect(datos).toContainText(`Ventas${api.cantidadVentas}`);
    await expect(datos).toContainText(soles(api.ticketPromedio));
    const metodos = main.locator('section:has(h2:text("Cómo pagaron")) li');
    for (const [i, m] of api.porMetodoPago.entries()) {
      await expect(metodos.nth(i)).toContainText(soles(m.total));
    }
  });

  await test.step('ventas por hora: detalle de la hora pico y vista de tabla', async () => {
    const figura = main.locator('figure').first();
    const detalle = figura.locator('p[aria-live]');
    const pico = api.porHora.reduce((a, h) =>
      Number(h.total) > Number(a.total) ? h : a,
    );
    await expect(detalle).toContainText(soles(pico.total));
    await expect(detalle).toContainText('(el mayor)');
    await figura
      .locator('button[aria-label]:not([aria-label*=": S/ 0.00"])')
      .first()
      .hover();
    await expect(detalle).not.toContainText('(el mayor)');
    await figura.getByRole('button', { name: 'Ver como tabla' }).click();
    await expect(figura.locator('tbody tr')).toHaveCount(api.porHora.length);
  });

  await test.step('ranking de productos en sus tres órdenes', async () => {
    const nombres = main.locator(
      'section:has(h2:text("Productos")) tbody tr td:nth-child(2) span.font-semibold',
    );
    for (const [orden, boton] of [
      ['cantidad', 'Más vendidos'],
      ['importe', 'Más dinero'],
      ['ganancia', 'Más ganancia'],
    ]) {
      const esperado = (
        await llamar<{ productos: { nombre: string }[] }>(
          `/reportes/productos?orden=${orden}&limite=10`,
          { token },
        )
      ).productos.map((p) => p.nombre);
      await page.click(`button:text-is("${boton}")`);
      await expect(nombres).toHaveText(esperado);
    }
  });

  await test.step('mercadería en la bodega', async () => {
    const inv = await llamar<{
      totales: { valorCosto: string; valorVenta: string };
    }>('/reportes/inventario', { token });
    await expect(main.locator('tfoot')).toContainText(
      soles(inv.totales.valorCosto),
    );
    await expect(main.locator('tfoot')).toContainText(
      soles(inv.totales.valorVenta),
    );
  });

  await test.step('otros periodos', async () => {
    await page.click('button:text-is("Últimos 7 días")');
    await expect(page.getByText('Ventas por día')).toBeVisible();
    await expect(
      main.locator('figure').nth(1).locator('button[aria-label]'),
    ).toHaveCount(7);
    const hace6 = new Date(`${hoy}T12:00:00Z`);
    hace6.setUTCDate(hace6.getUTCDate() - 6);
    const semana = await llamar<Resumen>(
      `/reportes/resumen?desde=${hace6.toISOString().slice(0, 10)}&hasta=${hoy}`,
      { token },
    );
    await expect(main.locator('.cifra').first()).toHaveText(
      soles(semana.totalVendido),
    );

    await page.click('button:text-is("Este mes")');
    const diasDelMes = Number(hoy.slice(8));
    if (diasDelMes > 1) {
      await expect(
        main.locator('figure').nth(1).locator('button[aria-label]'),
      ).toHaveCount(diasDelMes);
    }

    await page.click('button:text-is("Otro periodo")');
    await page.locator('input[type=date]').nth(0).fill(hoy);
    await page.locator('input[type=date]').nth(1).fill('2026-01-01');
    await expect(
      page.getByText('La fecha "Desde" no puede ser posterior a "Hasta".'),
    ).toBeVisible();

    await page.click('button:text-is("Ayer")');
    await expect(page.getByText(/^Vendido \d+ de /)).toBeVisible();
  });

  await test.step('en celular no hay scroll horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('button:text-is("Hoy")');
    await expect(page.getByText(/^Vendido hoy/)).toBeVisible();
    expect(await anchoDePagina(page)).toBeLessThanOrEqual(390);
  });
});

test('el cajero no ve los reportes', async ({ page }) => {
  const cajero = await crearCajero('Cajera Curiosa');
  await ingresar(page, cajero.usuario, cajero.password);
  await expect(page.locator('nav').getByText('Reportes')).toHaveCount(0);
  await page.goto('/reportes');
  await expect(
    page.getByText('Solo el administrador puede ver los reportes.'),
  ).toBeVisible();
});
