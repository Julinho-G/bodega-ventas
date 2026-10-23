/** Ingreso al sistema, abrir caja, cuadre y cierre del turno */
import {
  anchoDePagina,
  crearCajero,
  expect,
  ingresar,
  llamar,
  PRODUCTO,
  test,
} from './ayudas.ts';

const NOMBRE_TIENDA = "BODEGA D' CONSTANTINA";

test('sin sesión lleva al ingreso, que muestra el nombre de la tienda', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(
    page.getByRole('heading', { name: NOMBRE_TIENDA }),
  ).toBeVisible();
  await expect(page).toHaveTitle(`Caja · ${NOMBRE_TIENDA}`);
});

test('contraseña incorrecta: avisa y no entra', async ({ page }) => {
  await page.goto('/ingresar');
  await page.fill('#usuario', 'admin');
  await page.fill('#password', 'mala');
  await page.click('button[type=submit]');
  await expect(page.getByRole('alert')).toHaveText(
    'Usuario o contraseña incorrectos',
  );
  await expect(page).toHaveURL(/\/ingresar$/);
});

test('turno completo: abrir caja, vender, cuadrar, cerrar y salir', async ({
  page,
}) => {
  const cajero = await crearCajero('Rosa Cajera');

  await test.step('ingresa y ve la caja cerrada', async () => {
    await ingresar(page, cajero.usuario, cajero.password);
    await expect(
      page.getByText('Abre tu caja para empezar a vender'),
    ).toBeVisible();
    await page.click('nav >> text=Mi caja');
    await expect(page.getByText('Tu caja está cerrada')).toBeVisible();
    // Con 1366 px de ancho la cabecera muestra quién está en caja y su rol
    await expect(page.locator('header')).toContainText('Rosa Cajera');
    await expect(page.locator('header')).toContainText('Cajero');
  });

  await test.step('valida el monto y abre con "50,50" (acepta coma)', async () => {
    await page.fill('#monto', 'abc');
    await page.click('text=Abrir caja');
    await expect(page.getByRole('alert')).toHaveText(
      /^Escribe un monto válido/,
    );
    await page.fill('#monto', '50,50');
    await page.click('text=Abrir caja');
    await expect(page.getByText(/Caja abierta desde las/)).toBeVisible();
  });

  await test.step('una venta en efectivo se refleja en el cuadre (también tras recargar)', async () => {
    await llamar('/ventas', {
      token: cajero.token,
      cuerpo: {
        items: [{ productoId: PRODUCTO.arroz, cantidad: 2 }],
        metodoPago: 'EFECTIVO',
      },
    });
    await page.reload();
    // 50.50 de sencillo + 9.00 de la venta
    await expect(page.getByText('S/ 59.50').first()).toBeVisible();
  });

  await test.step('cierra contando S/ 59 y le informa el faltante', async () => {
    await page.fill('#contado', '59');
    await page.click('button:has-text("Cerrar caja")');
    await expect(page.getByText('Faltan S/ 0.50 en el cajón.')).toBeVisible();
    await page.click('text=Entendido');
    await expect(page.getByText('Tu caja está cerrada')).toBeVisible();
  });

  await test.step('salir borra la sesión', async () => {
    await page.click('text=Salir');
    await expect(page).toHaveURL(/\/ingresar$/);
    expect(
      await page.evaluate(() => localStorage.getItem('bodega.sesion')),
    ).toBeNull();
  });
});

test('en celular: nombre y "Salir" en la misma fila, sin scroll horizontal', async ({
  page,
}) => {
  const cajero = await crearCajero('Cajero Celular');
  await page.setViewportSize({ width: 375, height: 740 });
  await ingresar(page, cajero.usuario, cajero.password);
  const nombre = await page.locator('header p.cifra').boundingBox();
  const salir = await page.getByRole('button', { name: 'Salir' }).boundingBox();
  expect(
    Math.abs(nombre!.y + nombre!.height / 2 - (salir!.y + salir!.height / 2)),
  ).toBeLessThan(8);
  expect(await anchoDePagina(page)).toBeLessThanOrEqual(375);
});
