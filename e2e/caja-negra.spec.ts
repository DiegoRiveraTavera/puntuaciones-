import { test, expect, Page } from '@playwright/test';

/**
 * PRÁCTICA 8 — Pruebas de caja negra (Black Box Testing)
 * Proyecto: Puntuaciones - Escuadrón Moriah
 *
 * Cada test corresponde a un requisito (REQ-xx) del documento de la práctica.
 * Los tests describen el comportamiento ESPERADO: si un test falla, es un defecto.
 */

// Espera a que Angular termine de cargar la página antes de interactuar.
async function cargar(page: Page, ruta: string) {
  await page.goto(ruta, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('[ng-version]'));
  await page.waitForTimeout(1000);
}

async function login(page: Page, usuario = 'moriah', password = 'Segura2026') {
  await cargar(page, '/login');
  await page.fill('#usuario', usuario);
  await page.fill('#password', password);
  await page.click('button.entrar');
}

// Abre una pantalla. Las pantallas internas exigen sesión (REQ-14), así que primero
// se inicia sesión desde el formulario, igual que lo haría un usuario.
const sesionIniciada = new WeakSet<Page>();
async function abrir(page: Page, ruta: string) {
  if (ruta !== '/login' && !sesionIniciada.has(page)) {
    await login(page);
    await expect(page).toHaveURL(/\/inicio$/);
    sesionIniciada.add(page);
  }
  await cargar(page, ruta);
}

// ───────────────────────── Operaciones principales ─────────────────────────

test('REQ-01 Inicio de sesión con credenciales válidas redirige a Inicio', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('heading', { name: 'PUNTUACIONES' })).toBeVisible();
});

test('REQ-02 Registrar escuadra en Inicio la agrega a la tabla', async ({ page }) => {
  await abrir(page, '/inicio');
  const input = page.getByPlaceholder('Nombre de la escuadra (ej: RRMS, ANK, ATL)');
  await input.fill('ATL');
  await page.getByRole('button', { name: '+ Agregar' }).click();
  await input.fill('MNS');
  await input.press('Enter');
  const filas = page.locator('.tabla-escuadras tbody tr');
  await expect(filas).toHaveCount(2);
  await expect(filas.nth(0)).toContainText('ATL');
  await expect(filas.nth(1)).toContainText('MNS');
  await expect(input).toHaveValue('');
});

test('REQ-03 Formación calcula correctamente los puntos de la escuadra', async ({ page }) => {
  await abrir(page, '/formacion');
  await page.locator('select').first().selectOption('RRMS');
  const filas = page.locator('.tabla-formacion tbody tr');
  // 2 miembros con uniforme -> 20 pts
  for (const i of [0, 1]) {
    await filas.nth(i).locator('input[type=text]').first().fill(`Miembro ${i + 1}`);
    await filas.nth(i).locator('input[type=checkbox]').check();
  }
  await page.getByLabel('Uniforme del jefe/subjefe (10 pts)').check(); // +10
  await page.getByLabel('Bandera (5 pts)').check();                     // +5
  await page.getByLabel('Biblia (5 pts)').check();                      // +5
  const mats = page.locator('.mat-row input[type=number]');
  await mats.nth(0).fill('1'); // técnica  +10
  await mats.nth(1).fill('1'); // quizz    +10
  // Esperado: 30 (uniformes) + 20 (materiales) + 10 (accesorios) = 60
  await expect(page.locator('.total-grande')).toHaveText('60');
});

test('REQ-04 Técnica suma los 5 criterios y ordena el ranking', async ({ page }) => {
  await abrir(page, '/tecnica');
  const rrms = page.locator('.tabla-tecnica tbody tr').nth(0).locator('input');
  const notas = ['8', '7', '9', '6', '10'];
  for (let i = 0; i < 5; i++) await rrms.nth(i).fill(notas[i]);
  const ank = page.locator('.tabla-tecnica tbody tr').nth(1).locator('input');
  for (let i = 0; i < 5; i++) await ank.nth(i).fill('9');
  await expect(page.locator('.tabla-tecnica tbody tr').nth(0).locator('.total')).toContainText('40');
  await expect(page.locator('.tabla-tecnica tbody tr').nth(1).locator('.total')).toContainText('45');
  const ranking = page.locator('.ranking-item');
  await expect(ranking.nth(0)).toContainText('ANK');
  await expect(ranking.nth(1)).toContainText('RRMS');
});

test('REQ-05 Juegos asigna el valor del juego a la escuadra ganadora', async ({ page }) => {
  await abrir(page, '/juegos');
  await page.getByPlaceholder('Nombre del juego (ej. Tiro al blanco)').fill('Tiro al blanco');
  await page.getByPlaceholder('Valor (pts)').fill('15');
  await page.getByRole('button', { name: '+ Agregar' }).click();
  await page.getByRole('button', { name: '+ Agregar rol' }).click();
  await page.getByRole('button', { name: '+ Enfrentamiento' }).click();
  const selects = page.locator('.escuadra-select select');
  await selects.nth(0).selectOption('RRMS');
  await selects.nth(1).selectOption('ANK');
  await page.locator('.ganador-select select').selectOption('ANK');
  const item = page.locator('.ranking-item').first();
  await expect(item).toContainText('ANK');
  await expect(item).toContainText('15 pts');
});

test('REQ-06 Lugares muestra el podio ordenado por puntaje total', async ({ page }) => {
  await abrir(page, '/lugares');
  await expect(page.locator('.podio-card.oro .podio-nombre')).toHaveText('ATL');
  await expect(page.locator('.podio-card.oro .podio-pts')).toHaveText('175 pts');
  await expect(page.locator('.podio-card.plata .podio-nombre')).toHaveText('RRMS');
  await expect(page.locator('.podio-card.bronce .podio-nombre')).toHaveText('SJN');
});

// ───────────────────────────────── Validaciones ─────────────────────────────

test('REQ-07 Login rechaza entradas inválidas con mensajes claros', async ({ page }) => {
  await abrir(page, '/login');
  const alerta = page.getByRole('alert');

  await page.click('button.entrar'); // campos vacíos
  await expect(alerta).toHaveText('Ingresa tu usuario y contraseña.');

  await page.fill('#usuario', 'moriah');
  await page.fill('#password', 'abc123'); // < 8 caracteres
  await page.click('button.entrar');
  await expect(alerta).toHaveText('La contraseña debe tener al menos 8 caracteres.');

  await page.fill('#password', 'Incorrecta99');
  await page.click('button.entrar');
  await expect(alerta).toHaveText('Usuario o contraseña incorrectos.');
  await expect(page.locator('#password')).toHaveValue(''); // no conserva la contraseña
  await expect(page).toHaveURL(/\/login$/);
});

test('REQ-08 Inicio rechaza escuadras vacías y duplicadas', async ({ page }) => {
  await abrir(page, '/inicio');
  const input = page.getByPlaceholder('Nombre de la escuadra (ej: RRMS, ANK, ATL)');
  await input.fill('   ');
  await page.getByRole('button', { name: '+ Agregar' }).click();
  await expect(page.locator('.tabla-escuadras')).toHaveCount(0);

  await input.fill('RRMS');
  await input.press('Enter');
  let dialogo = '';
  page.once('dialog', d => { dialogo = d.message(); d.accept(); });
  await input.fill('rrms'); // mismo nombre en minúsculas
  await input.press('Enter');
  await expect(page.locator('.tabla-escuadras tbody tr')).toHaveCount(1);
  expect(dialogo).toContain('ya está en la lista');
});

test('REQ-09 Técnica solo acepta calificaciones de 1 a 10', async ({ page }) => {
  await abrir(page, '/tecnica');
  const fila = page.locator('.tabla-tecnica tbody tr').nth(0);
  const celdas = fila.locator('input');
  // Caso A: un valor mayor a 10 (15) con el resto en 10 -> el total no debe pasar de 50
  await celdas.nth(0).fill('15');
  for (let i = 1; i < 5; i++) await celdas.nth(i).fill('10');
  const totalA = Number((await fila.locator('.total').innerText()).split('/')[0]);
  // Caso B: un valor negativo (-3) -> no debe aceptarse
  await celdas.nth(1).fill('-3');
  const valorB = Number(await celdas.nth(1).inputValue());
  expect.soft(totalA, 'Total con una calificación de 15').toBeLessThanOrEqual(50);
  expect.soft(valorB, 'Valor capturado al escribir -3').toBeGreaterThanOrEqual(1);
});

test('REQ-10 Juegos no permite crear un juego sin nombre o con valor ≤ 0', async ({ page }) => {
  await abrir(page, '/juegos');
  await page.getByPlaceholder('Valor (pts)').fill('10');
  await page.getByRole('button', { name: '+ Agregar' }).click(); // sin nombre
  await page.getByPlaceholder('Nombre del juego (ej. Tiro al blanco)').fill('Carrera');
  await page.getByPlaceholder('Valor (pts)').fill('0');
  await page.getByRole('button', { name: '+ Agregar' }).click(); // valor 0
  await expect(page.locator('.tab-juego')).toHaveCount(0);
});

// ──────────────────────── Persistencia / consistencia ───────────────────────

test('REQ-11 Los datos guardados se conservan al recargar la página', async ({ page }) => {
  await abrir(page, '/inicio');
  const input = page.getByPlaceholder('Nombre de la escuadra (ej: RRMS, ANK, ATL)');
  await input.fill('SMN');
  await input.press('Enter');
  await page.getByRole('button', { name: '💾 Guardar' }).click();
  await expect(page.getByText('Escuadras guardadas correctamente')).toBeVisible();
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.tabla-escuadras tbody tr')).toContainText('SMN');
});

test('REQ-12 Al quitar la escuadra ganadora de un enfrentamiento se anulan sus puntos', async ({ page }) => {
  await abrir(page, '/juegos');
  await page.getByPlaceholder('Nombre del juego (ej. Tiro al blanco)').fill('Relevos');
  await page.getByPlaceholder('Valor (pts)').fill('20');
  await page.getByRole('button', { name: '+ Agregar' }).click();
  await page.getByRole('button', { name: '+ Agregar rol' }).click();
  await page.getByRole('button', { name: '+ Enfrentamiento' }).click();
  await page.getByRole('button', { name: '+ escuadra' }).click();
  const selects = page.locator('.escuadra-select select');
  await selects.nth(0).selectOption('RRMS');
  await selects.nth(1).selectOption('ANK');
  await selects.nth(2).selectOption('ATL');
  await page.locator('.ganador-select select').selectOption('ANK');
  await expect(page.locator('.ranking-item').first()).toContainText('ANK');
  // Se elimina ANK (la ganadora) del enfrentamiento
  await page.locator('.escuadra-select').nth(1).locator('.btn-quitar').click();
  await expect(page.locator('.escuadra-select select')).toHaveCount(2);
  // Esperado: ANK ya no participa, por lo tanto no debe conservar los 20 pts
  await expect(page.getByText('Puntos acumulados en juegos')).toHaveCount(0);
});

test('REQ-13 Eliminar una escuadra la quita y renumera la tabla', async ({ page }) => {
  await abrir(page, '/inicio');
  const input = page.getByPlaceholder('Nombre de la escuadra (ej: RRMS, ANK, ATL)');
  for (const n of ['RRMS', 'ANK', 'ATL']) { await input.fill(n); await input.press('Enter'); }
  await page.locator('.tabla-escuadras tbody tr').nth(1).getByRole('button', { name: 'Eliminar' }).click();
  const filas = page.locator('.tabla-escuadras tbody tr');
  await expect(filas).toHaveCount(2);
  await expect(filas.nth(1)).toContainText('ATL');
  await expect(filas.nth(1).locator('.num-badge')).toHaveText('2');
  await expect(page.locator('.tabla-escuadras')).not.toContainText('ANK');
});

// ────────────────────── Navegación, roles y permisos ────────────────────────

test('REQ-14 Las pantallas internas exigen sesión iniciada', async ({ page }) => {
  for (const ruta of ['/inicio', '/formacion', '/juegos', '/tecnica', '/lugares']) {
    await page.goto(ruta);
    await page.waitForLoadState('domcontentloaded');
    await expect(page, `Acceso sin login a ${ruta}`).toHaveURL(/\/login$/);
  }
});

test('REQ-15 El buscador lleva a la pantalla del resultado seleccionado', async ({ page }) => {
  // Se simula la respuesta del backend con los mismos documentos que siembra elastic-client.ts
  await page.route('**/api/buscar**', r => r.fulfill({
    json: [{ title: 'Acerca de', description: 'Quiénes somos y ubicación', route: '/acerca-de', type: 'página' }],
  }));
  await abrir(page, '/inicio');
  await page.locator('.search-btn').click();
  const respuesta = page.waitForResponse('**/api/buscar**');
  await page.locator('.search-input').fill('acerca');
  await respuesta;
  // a) Al llegar la respuesta, el resultado debe mostrarse sin más interacción
  await expect.soft(page.locator('.search-item'), 'Resultados visibles tras la respuesta').toHaveCount(1);
  // b) Se fuerza otro evento para poder seguir probando la navegación
  await page.locator('.search-input').press('End');
  await page.locator('.search-input').pressSequentially(' ');
  await page.locator('.search-item').first().click();
  await expect(page, 'Destino del resultado "Acerca de"').toHaveURL(/\/acerca$/);
});

test('REQ-16 El enlace de sesión solo funciona una vez', async ({ page }) => {
  const codigo = `PRUEBA-${Date.now()}`;
  await page.goto(`/sesion/${codigo}`);
  await expect(page.getByRole('heading', { name: '✅ Sesión iniciada' })).toBeVisible();
  await page.goto(`/sesion/${codigo}`);
  await expect(page.getByRole('heading', { name: '⛔ Enlace ya utilizado' })).toBeVisible();
});

// ───────────────────────────── Manejo de errores ────────────────────────────

test('REQ-17 Si el servicio de búsqueda falla, se informa al usuario', async ({ page }) => {
  await page.route('**/api/buscar**', r => r.fulfill({ status: 500, json: { error: 'Error al buscar' } }));
  await abrir(page, '/inicio');
  await page.locator('.search-btn').click();
  const respuesta = page.waitForResponse('**/api/buscar**');
  await page.locator('.search-input').fill('juegos');
  await respuesta;
  await page.waitForTimeout(500);
  // Esperado: un mensaje de error, no "Sin resultados" (que engaña al usuario)
  await expect(page.locator('.search-results')).not.toContainText('Sin resultados');
});

test('REQ-18 La API de notificaciones acepta una petición JSON válida', async ({ request }) => {
  const res = await request.post('/api/notificaciones/tecnica', {
    data: { escuadra: 'ATL', puntos: 45 },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});