/** Pantalla de venta: lector de código de barras, granel, vuelto, errores y fiado */
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

test('un día en la caja', async ({ page }) => {
  const cajero = await crearCajero('Lucho Cajero');
  const buscar = page.locator('#buscar');
  const total = page.locator('[aria-live=polite]').first();
  const cantidad = (producto: string | RegExp) =>
    page.getByRole('textbox', {
      name: typeof producto === 'string' ? `Cantidad de ${producto}` : producto,
    });
  const enfocado = (l: typeof buscar) =>
    l.evaluate((el) => el === document.activeElement);

  await test.step('sin caja pide abrirla; la abre con S/ 100', async () => {
    await ingresar(page, cajero.usuario, cajero.password);
    await expect(
      page.getByText('Abre tu caja para empezar a vender'),
    ).toBeVisible();
    await page.click('text=Ir a abrir caja');
    await page.fill('#monto', '100');
    await page.click('text=Abrir caja');
    await expect(page.getByText(/Caja abierta desde/)).toBeVisible();
    await page.click('nav >> text=Vender');
    await expect(buscar).toBeVisible();
  });

  await test.step('escanear el arroz dos veces seguidas suma 2', async () => {
    for (let i = 0; i < 2; i++) {
      await buscar.fill('7750243001234');
      await buscar.press('Enter');
    }
    await expect(cantidad('Arroz Costeño 750 g')).toHaveValue('2');
    expect(await enfocado(buscar)).toBe(true);
  });

  await test.step('"3*inca" agrega 3 Inca Kola', async () => {
    await buscar.fill('3*inca');
    await page.getByRole('option').first().waitFor();
    await buscar.press('Enter');
    await expect(cantidad('Inca Kola 500 ml')).toHaveValue('3');
  });

  await test.step('granel: el cursor pasa al peso y sin peso no se cobra', async () => {
    await buscar.fill('azucar');
    await page.getByRole('option').first().waitFor();
    await buscar.press('Enter');
    const peso = cantidad(/Cantidad de Azúcar/);
    await expect(peso).toBeFocused();
    await expect(page.getByRole('button', { name: /Cobrar/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await peso.fill('0,5');
    await peso.press('Enter');
    await expect(buscar).toBeFocused();
    // 2 × 4.50 + 3 × 2.50 + 0.5 kg × 4.00
    await expect(total).toHaveText('S/ 18.50');
  });

  await test.step('paga con S/ 20: vuelto en vivo y cobro con F2', async () => {
    await page.click('button:text-is("20")');
    await expect(page.getByText('Vuelto: S/ 1.50')).toBeVisible();
    await page.keyboard.press('F2');
    await expect(page.getByText('Venta registrada')).toBeVisible();
    // El vuelto oficial lo calcula el backend
    await expect(page.locator('main .cifra').last()).toHaveText('S/ 1.50');
    await page.click('text=Nueva venta');
    await expect(buscar).toBeFocused();
  });

  await test.step('código que no existe', async () => {
    await buscar.fill('99999999');
    await buscar.press('Enter');
    await expect(
      page.getByText('No hay ningún producto con el código 99999999'),
    ).toBeVisible();
  });

  await test.step('stock insuficiente lo avisa el backend; con 10 panes sí vende por Yape', async () => {
    await buscar.fill('999*pan');
    await page.getByRole('option').first().waitFor();
    await buscar.press('Enter');
    await page.click('label:has-text("Yape")');
    await page.keyboard.press('F2');
    await expect(page.getByRole('alert').last()).toContainText(
      'Stock insuficiente',
    );
    await cantidad('Pan francés').fill('10');
    await page.keyboard.press('F2');
    await expect(page.getByText('pagada con yape')).toBeVisible();
    await expect(page.locator('main .cifra').last()).toHaveText('S/ 2.00');
    await page.click('text=Nueva venta');
  });

  await test.step('fiado: bloquea si supera el crédito; dentro del límite se registra', async () => {
    const vecina = `Vecina Prueba ${unico()}`;
    await llamar('/clientes', {
      token: await tokenAdmin(),
      cuerpo: { nombre: vecina, limiteCredito: 10 },
    });
    await buscar.fill('aceite');
    await page.getByRole('option').first().waitFor();
    await buscar.press('Enter');
    await page.click('label:has-text("Fiado")');
    await page.fill('#cliente', vecina);
    await page.getByRole('button', { name: new RegExp(vecina) }).click();
    // Aceite S/ 10.50 con límite S/ 10.00
    await expect(
      page.getByText('El fiado supera el crédito disponible del cliente'),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Quitar Aceite Primor 1 L' })
      .click();
    await buscar.fill('leche');
    await page.getByRole('option').first().waitFor();
    await buscar.press('Enter');
    await page.keyboard.press('F2');
    await expect(page.getByText('pagada con fiado')).toBeVisible();
    await page.click('text=Nueva venta');
  });

  await test.step('Mi caja: efectivo esperado = 100 + 18.50 (Yape y fiado no entran al cajón)', async () => {
    await page.click('nav >> text=Mi caja');
    await expect(page.getByText('Total vendido')).toBeVisible();
    await expect(page.getByText('S/ 118.50').first()).toBeVisible();
  });

  await test.step('en celular la pantalla de venta no tiene scroll horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('nav >> text=Vender');
    await buscar.fill('7750243001234');
    await buscar.press('Enter');
    await expect(cantidad('Arroz Costeño 750 g')).toBeVisible();
    expect(await anchoDePagina(page)).toBeLessThanOrEqual(390);
  });
});
