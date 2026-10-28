import { test, expect, Page } from '@playwright/test';

/**
 * PRÁCTICA — Pirámide de pruebas
 * Fase 4: PRUEBA E2E del flujo crítico "registrar la puntuación de un juego".
 *
 * Recorre la app como un usuario real, de principio a fin:
 * login → menú → Juegos → crear juego → rol → enfrentamiento → ganador → resumen → guardar
 * y al final comprueba si el resultado se conserva al recargar la página.
 */

async function esperarAngular(page: Page) {
  await page.waitForFunction(() => !!document.querySelector('[ng-version]'));
  await page.waitForTimeout(800);
}

test('E-01 registrar la puntuación de un juego, de inicio de sesión a persistencia', async ({ page }) => {
  await test.step('1. Iniciar sesión con el usuario de prueba', async () => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await esperarAngular(page);
    await page.fill('#usuario', 'moriah');
    await page.fill('#password', 'Segura2026');
    await page.click('button.entrar');
    await expect(page).toHaveURL(/\/inicio$/);
  });

  await test.step('2. Entrar a Juegos desde el menú', async () => {
    await page.getByRole('button', { name: 'Juegos' }).click();
    await expect(page).toHaveURL(/\/juegos$/);
    await expect(page.getByRole('heading', { name: 'Juegos', level: 1 })).toBeVisible();
  });

  await test.step('3. Crear el juego "Tiro al blanco" de 15 pts', async () => {
    await page.getByPlaceholder('Nombre del juego (ej. Tiro al blanco)').fill('Tiro al blanco');
    await page.getByPlaceholder('Valor (pts)').fill('15');
    await page.getByRole('button', { name: '+ Agregar' }).click();
    await expect(page.locator('.tab-juego')).toHaveCount(1);
  });

  await test.step('4. Registrar un enfrentamiento RRMS vs ANK y elegir a ANK como ganador', async () => {
    await page.getByRole('button', { name: '+ Agregar rol' }).click();
    await page.getByRole('button', { name: '+ Enfrentamiento' }).click();
    const selects = page.locator('.escuadra-select select');
    await selects.nth(0).selectOption('RRMS');
    await selects.nth(1).selectOption('ANK');
    await page.locator('.ganador-select select').selectOption('ANK');
  });

  await test.step('5. Comprobar el resultado: ANK suma 15 pts en el resumen', async () => {
    const resumen = page.locator('.ranking-item');
    await expect(resumen).toHaveCount(1);
    await expect(resumen.first()).toContainText('ANK');
    await expect(resumen.first()).toContainText('15 pts');
  });

  await test.step('6. Guardar y ver la confirmación', async () => {
    await page.getByRole('button', { name: '💾 Guardar' }).click();
    await expect(page.getByText('Guardado correctamente')).toBeVisible();
    await page.screenshot({ path: 'evidencias/E-01-antes-de-recargar.png', fullPage: true });
  });

  await test.step('7. Recargar la página: el juego y los puntos deben seguir ahí', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await esperarAngular(page);
    await page.screenshot({ path: 'evidencias/E-01-despues-de-recargar.png', fullPage: true });
    await expect(page.locator('.tab-juego'), 'juego guardado tras recargar').toHaveCount(1);
    await expect(page.locator('.ranking-item').first(), 'puntos de ANK tras recargar').toContainText('15 pts');
  });
});
