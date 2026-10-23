/** Productos e inventario (solo administrador): crear, ingresos, mermas, conteo y kardex */
import {
  anchoDePagina,
  crearCajero,
  expect,
  ingresar,
  test,
  unico,
} from './ayudas.ts';

test('ciclo de vida de un producto', async ({ page }) => {
  const id = unico();
  const nombre = `Atún Prueba ${id}`;
  const panel = page.locator('#ficha-producto');
  const aviso = panel.getByRole('alert').last();

  await test.step('busca sin tildes ("azucar")', async () => {
    await ingresar(page, 'admin', 'admin123');
    await page.click('nav >> text=Productos');
    await page.fill('#buscar-producto', 'azucar');
    await expect(page.getByText('Azúcar rubia (granel)')).toBeVisible();
  });

  await test.step('crear: valida nombre y precio, y muestra la ganancia', async () => {
    await page.click('text=Nuevo producto');
    await panel.getByRole('button', { name: 'Crear producto' }).click();
    await expect(aviso).toHaveText('Escribe el nombre del producto');
    await page.fill('#p-nombre', nombre);
    await page.fill('#p-codigo', `55${id}`);
    await page.selectOption('#p-categoria', { label: 'Abarrotes' });
    await page.fill('#p-compra', '4.20');
    await page.fill('#p-venta', '3,90');
    await panel.getByRole('button', { name: 'Crear producto' }).click();
    await expect(aviso).toHaveText(
      'El precio de venta no puede ser menor que el costo',
    );
    await page.fill('#p-venta', '5.50');
    await expect(
      panel.getByText('Ganas S/ 1.30 por unidad (24 % del precio)'),
    ).toBeVisible();
    await page.fill('#p-inicial', '12');
    await page.fill('#p-minimo', '5');
    await panel.getByRole('button', { name: 'Crear producto' }).click();
    await expect(panel.getByRole('heading', { name: nombre })).toBeVisible();
    await expect(panel.locator('dd').nth(2)).toHaveText('12 und');
    await expect(
      panel.getByText('El stock coincide con los movimientos'),
    ).toBeVisible();
  });

  await test.step('llegó mercadería con costo nuevo', async () => {
    await panel.getByRole('tab', { name: 'Llegó mercadería' }).click();
    await page.fill('#m-cantidad', '24');
    await page.fill('#m-costo', '4.40');
    await panel.getByRole('button', { name: 'Registrar ingreso' }).click();
    await expect(
      panel.getByText('Ingreso registrado. Ahora hay 36 und.'),
    ).toBeVisible();
    await expect(panel.getByText('S/ 4.40')).toBeVisible();
  });

  await test.step('merma con motivo obligatorio', async () => {
    await panel.getByRole('tab', { name: 'Merma' }).click();
    await page.fill('#m-cantidad', '2');
    await panel.getByRole('button', { name: 'Registrar merma' }).click();
    await expect(aviso).toHaveText('Escribe o elige el motivo');
    await panel.getByRole('button', { name: 'Roto o dañado' }).click();
    await panel.getByRole('button', { name: 'Registrar merma' }).click();
    await expect(
      panel.getByText('Merma registrada. Ahora hay 34 und.'),
    ).toBeVisible();
  });

  await test.step('conteo del anaquel y kardex', async () => {
    await panel.getByRole('tab', { name: 'Conteo' }).click();
    await page.fill('#m-cantidad', '34');
    await panel.getByRole('button', { name: 'Registrar conteo' }).click();
    await expect(aviso).toContainText('no hay diferencia');
    await page.fill('#m-cantidad', '30');
    await panel.getByRole('button', { name: 'Registrar conteo' }).click();
    await expect(
      panel.getByText('Conteo registrado: faltaban 4 und. Ahora hay 30 und.'),
    ).toBeVisible();
    await expect(
      panel.getByText('El stock coincide con los movimientos'),
    ).toBeVisible();
    // Lo más reciente primero: Ajuste, Merma, Entrada (ingreso), Entrada (stock inicial)
    const filas = panel.locator('tbody tr');
    await expect(filas).toHaveCount(4);
    await expect(filas.first()).toContainText('Ajuste');
    await expect(filas.first()).toContainText('30 und');
    await expect(filas.last()).toContainText('Entrada');
    await expect(filas.last()).toContainText('+12');
  });

  await test.step('subir el stock mínimo lo marca como "stock bajo"', async () => {
    await panel.getByRole('button', { name: 'Editar' }).click();
    await page.fill('#p-minimo', '40');
    await panel.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(panel.getByText('Cambios guardados.')).toBeVisible();
    await expect(
      panel.getByText(/Stock bajo: el aviso es a partir de 40 und/),
    ).toBeVisible();
    await page.fill('#buscar-producto', '');
    await page.click('text=Stock bajo');
    await expect(page.locator('ul').getByText(nombre)).toBeVisible();
  });

  await test.step('descontinuado: sale de "En venta" pero sigue en "Todos"', async () => {
    await page.click('text=En venta');
    await panel.getByRole('button', { name: 'Editar' }).click();
    await page.uncheck('input[type=checkbox]');
    await panel.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(
      panel.getByText('Descontinuado: no aparece en la caja'),
    ).toBeVisible();
    await page.fill('#buscar-producto', `atun prueba ${id}`);
    await expect(page.locator('ul').getByText(nombre)).toHaveCount(0);
    await page.click('text=Todos, con descontinuados');
    await expect(page.locator('ul').getByText(nombre)).toBeVisible();
  });

  await test.step('no acepta un código de barras repetido', async () => {
    await page.click('text=Nuevo producto');
    await page.fill('#p-nombre', `Otro ${id}`);
    await page.fill('#p-codigo', '7750243001234');
    await page.selectOption('#p-categoria', { label: 'Abarrotes' });
    await page.fill('#p-compra', '1');
    await page.fill('#p-venta', '2');
    await panel.getByRole('button', { name: 'Crear producto' }).click();
    await expect(aviso).toContainText(/código/i);
  });

  await test.step('en celular no hay scroll horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await anchoDePagina(page)).toBeLessThanOrEqual(390);
  });
});

test('el cajero no puede gestionar productos', async ({ page }) => {
  const cajero = await crearCajero('Cajera Productos');
  await ingresar(page, cajero.usuario, cajero.password);
  await expect(page.locator('nav').getByText('Productos')).toHaveCount(0);
  await page.goto('/productos');
  await expect(
    page.getByText('Solo el administrador puede gestionar'),
  ).toBeVisible();
});
