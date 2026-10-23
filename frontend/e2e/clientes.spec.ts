/** Clientes y fiado: registrar, fiar desde la caja, cobrar y estado de cuenta */
import {
  anchoDePagina,
  crearCajero,
  expect,
  ingresar,
  llamar,
  test,
  tokenAdmin,
  unico,
} from './ayudas.ts';

test('fiado de principio a fin', async ({ page }) => {
  const id = unico();
  const nombre = `Doña Núñez ${id}`;
  const dni = `4${Date.now().toString().slice(-7)}`;
  const panel = page.locator('#ficha-cliente');
  const aviso = panel.getByRole('alert').last();
  // El administrador vende y cobra: necesita su caja abierta
  await llamar('/caja/abrir', {
    token: await tokenAdmin(),
    cuerpo: { montoInicial: 50 },
  });

  await test.step('registrar: valida DNI y celular', async () => {
    await ingresar(page, 'admin', 'admin123');
    await page.click('nav >> text=Clientes');
    await page.click('text=Nuevo cliente');
    await page.fill('#c-nombre', nombre);
    await page.fill('#c-dni', '123');
    await panel.getByRole('button', { name: 'Registrar cliente' }).click();
    await expect(aviso).toHaveText('El DNI debe tener 8 dígitos');
    await page.fill('#c-dni', dni);
    await page.fill('#c-telefono', '812345678');
    await panel.getByRole('button', { name: 'Registrar cliente' }).click();
    await expect(aviso).toHaveText(
      'El celular debe tener 9 dígitos y empezar con 9',
    );
    await page.fill('#c-telefono', '987654321');
    await page.fill('#c-limite', '20');
    await panel.getByRole('button', { name: 'Registrar cliente' }).click();
    await expect(panel.getByRole('heading', { name: nombre })).toBeVisible();
    await expect(panel.getByText('No tiene deuda.')).toBeVisible();
  });

  await test.step('la encuentra buscando "nunez" (sin tilde)', async () => {
    await page.fill('#buscar-cliente', `nunez ${id}`);
    await expect(page.locator('ul').getByText(nombre)).toBeVisible();
  });

  await test.step('le fían 2 leches desde la caja', async () => {
    await page.click('nav >> text=Vender');
    await page.locator('#buscar').fill('2*leche');
    await page.getByRole('option').first().waitFor();
    await page.locator('#buscar').press('Enter');
    await page.click('label:has-text("Fiado")');
    await page.fill('#cliente', nombre);
    await page.getByRole('button', { name: new RegExp(nombre) }).click();
    await page.keyboard.press('F2');
    await expect(page.getByText('Venta registrada')).toBeVisible();
    await page.click('text=Nueva venta');
  });

  await test.step('aparece entre los deudores con su estado de cuenta', async () => {
    await page.click('nav >> text=Clientes');
    await page.click('text=Solo los que deben');
    await page.fill('#buscar-cliente', '');
    const fila = page.locator('li', { hasText: nombre });
    await expect(fila.getByText('Debe S/ 8.60')).toBeVisible();
    await fila.click();
    await expect(panel.locator('.cifra')).toHaveText('S/ 8.60');
    await expect(
      panel.getByText('2 und Leche Gloria tarro 400 g'),
    ).toBeVisible();
    // Límite 20.00 − deuda 8.60
    await expect(panel.getByText('S/ 11.40')).toBeVisible();
  });

  await test.step('cobro parcial, luego "Todo"', async () => {
    await page.fill('#pago', '10');
    await panel.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(aviso).toHaveText(/^Solo debe S\/ 8.60/);
    await page.fill('#pago', '5');
    await panel.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(
      panel.getByText('Pago de S/ 5.00 registrado. Ahora debe S/ 3.60.'),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Todo' }).click();
    await expect(page.locator('#pago')).toHaveValue('3.60');
    await panel.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(
      panel.getByText(`Pago de S/ 3.60 registrado. ${nombre} ya no debe nada.`),
    ).toBeVisible();
    await expect(panel.getByText('No tiene deuda.')).toBeVisible();
    const filas = panel.locator('tbody tr');
    await expect(filas).toHaveCount(3);
    await expect(filas.first()).toContainText('Pago a cuenta');
    await expect(filas.first()).toContainText('S/ 0.00');
    await expect(filas.last()).toContainText('Fiado');
  });

  await test.step('los cobros entran al efectivo de Mi caja', async () => {
    await page.click('nav >> text=Mi caja');
    await expect(page.locator('main dl').first()).toContainText(
      'Cobros de fiado+ S/ 8.60',
    );
    // 50 de sencillo + 8.60 cobrados
    await expect(page.locator('main .cifra').first()).toHaveText('S/ 58.60');
  });
});

test('el cajero registra clientes, pero no les asigna crédito', async ({
  page,
}) => {
  const cajero = await crearCajero('Cajero Clientes');
  const vecino = `Vecino del cajero ${unico()}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await ingresar(page, cajero.usuario, cajero.password);
  await page.click('nav >> text=Clientes');
  await page.click('text=Nuevo cliente');
  await expect(page.locator('#c-limite')).toHaveCount(0);
  await expect(
    page.getByText('El límite de crédito lo asigna el administrador'),
  ).toBeVisible();
  await page.fill('#c-nombre', vecino);
  await page.getByRole('button', { name: 'Registrar cliente' }).click();
  await expect(page.getByRole('heading', { name: vecino })).toBeVisible();
  await expect(page.locator('#ficha-cliente dd').first()).toHaveText('S/ 0.00');
  expect(await anchoDePagina(page)).toBeLessThanOrEqual(390);
});
