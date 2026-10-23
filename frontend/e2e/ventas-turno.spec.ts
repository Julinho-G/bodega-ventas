/** Ventas del turno: lista, detalle y anulación con motivo */
import {
  anchoDePagina,
  crearCajero,
  expect,
  ingresar,
  llamar,
  PRODUCTO,
  test,
} from './ayudas.ts';

test('anular una venta devuelve el stock y corrige el resumen', async ({
  page,
}) => {
  const cajero = await crearCajero('Ana Cajera');
  const t = cajero.token;
  await llamar('/caja/abrir', { token: t, cuerpo: { montoInicial: 50 } });
  await llamar('/ventas', {
    token: t,
    cuerpo: {
      items: [{ productoId: PRODUCTO.arroz, cantidad: 2 }],
      metodoPago: 'EFECTIVO',
    },
  });
  const yape = await llamar<{ id: number }>('/ventas', {
    token: t,
    cuerpo: {
      items: [{ productoId: PRODUCTO.incaKola, cantidad: 1 }],
      metodoPago: 'YAPE',
    },
  });
  const stockInca = async () =>
    Number(
      (
        await llamar<{ stock: string }>(`/productos/${PRODUCTO.incaKola}`, {
          token: t,
        })
      ).stock,
    );
  const stockAntes = await stockInca();
  const resumen = page.locator('h1 + p');
  const filaYape = page.getByRole('button', {
    name: new RegExp(`N.º ${yape.id}`),
  });

  await test.step('la lista muestra las 2 ventas del turno', async () => {
    await ingresar(page, cajero.usuario, cajero.password);
    await page.click('nav >> text=Ventas');
    await expect(resumen).toContainText('2 ventas por S/ 11.50');
    await expect(page.locator('main ul > li')).toHaveCount(2);
  });

  await test.step('el detalle muestra los productos', async () => {
    await filaYape.click();
    await expect(page.getByText('1 und Inca Kola 500 ml')).toBeVisible();
  });

  await test.step('anular exige motivo', async () => {
    await page.click('text=Anular esta venta');
    await page.click(`button:has-text("Anular N.º ${yape.id}")`);
    await expect(
      page.getByText('Escribe o elige el motivo de la anulación'),
    ).toBeVisible();
    await page.click('text=Cobro duplicado');
    await page.click(`button:has-text("Anular N.º ${yape.id}")`);
    await expect(
      page.getByText(`La venta N.º ${yape.id} quedó anulada`),
    ).toBeVisible();
  });

  await test.step('resumen, fila y stock quedan corregidos', async () => {
    await expect(resumen).toContainText('1 venta por S/ 9.00');
    await expect(resumen).toContainText('1 anulada');
    await expect(
      page.locator('li', { hasText: `N.º ${yape.id}` }).getByText('Anulada'),
    ).toBeVisible();
    expect(await stockInca()).toBe(stockAntes + 1);
    await filaYape.click();
    await expect(page.getByText('Esta venta está anulada')).toBeVisible();
    await expect(page.getByText('Anular esta venta')).toHaveCount(0);
  });

  await test.step('Mi caja descuenta la venta anulada', async () => {
    await page.click('nav >> text=Mi caja');
    await expect(page.locator('p:has-text("Total vendido")')).toContainText(
      'S/ 9.00',
    );
    await expect(page.getByText('1 venta anulada')).toBeVisible();
  });

  await test.step('una venta nueva aparece al instante en la lista', async () => {
    await page.click('nav >> text=Vender');
    await page.locator('#buscar').fill('7750243001234');
    await page.locator('#buscar').press('Enter');
    await page.getByRole('textbox', { name: /Cantidad de Arroz/ }).waitFor();
    await page.keyboard.press('F2');
    await expect(page.getByText('Venta registrada')).toBeVisible();
    await page.click('nav >> text=Ventas');
    await expect(resumen).toContainText('2 ventas por S/ 13.50');
  });

  await test.step('en celular no hay scroll horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await anchoDePagina(page)).toBeLessThanOrEqual(390);
  });
});
