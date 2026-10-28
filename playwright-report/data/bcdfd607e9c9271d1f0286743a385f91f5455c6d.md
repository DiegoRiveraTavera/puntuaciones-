# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: caja-negra.spec.ts >> REQ-14 Las pantallas internas exigen sesión iniciada
- Location: e2e\caja-negra.spec.ts:216:5

# Error details

```
Error: Acceso sin login a /inicio

expect(page).toHaveURL(expected) failed

Expected pattern: /\/login$/
Received string:  "https://puntuaciones.vercel.app/inicio"
Timeout: 15000ms

Call log:
  - Acceso sin login a /inicio with timeout 15000ms
    32 × locator resolved to <html lang="en" data-beasties-container="">…</html>
       - unexpected value "https://puntuaciones.vercel.app/inicio"

```

```yaml
- navigation:
  - img "Logo"
  - button "Inicio"
  - button "Formación"
  - button "Juegos"
  - button "Técnica"
  - button "Lugares"
  - button "Acerca"
  - button "Estadísticas"
  - button "Sesion"
  - button "🔍"
- heading "Escuadrón Moriah" [level=2]
- paragraph: La forma más rápida y justa de llevar el control de juegos, técnica, formación y el ranking general de tu escuadrón. Registra, califica y consulta resultados en tiempo real, sin hojas de papel ni cálculos a mano.
- img "Escuadrón Moriah"
- heading "PUNTUACIONES" [level=1]
- text: "FECHA:"
- textbox: 2026-10-23
- heading "Agregar Escuadra" [level=3]
- 'textbox "Nombre de la escuadra (ej: RRMS, ANK, ATL)"'
- button "+ Agregar"
- button "💾 Guardar"
- text: RRMS 12 miembros 85 puntos ⚠ Adeudo pendiente
- button "Enviar al reloj"
- contentinfo:
  - heading "Escuadrón Moriah" [level=3]
  - paragraph: escuadron.moriah@gmail.com
  - link "Facebook":
    - /url: https://www.facebook.com/EscuadronMoriah
    - img
  - link "Instagram":
    - /url: https://www.instagram.com/escuadron_moriah?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==
    - img
  - heading "Contáctanos" [level=4]
  - textbox "Tu nombre"
  - textbox "Tu correo"
  - textbox "Mensaje"
  - button "Enviar"
  - paragraph: Derechos reservados © 2026 · Escuadrón Moriah
```

# Test source

```ts
  120 |   await expect(alerta).toHaveText('Usuario o contraseña incorrectos.');
  121 |   await expect(page.locator('#password')).toHaveValue(''); // no conserva la contraseña
  122 |   await expect(page).toHaveURL(/\/login$/);
  123 | });
  124 | 
  125 | test('REQ-08 Inicio rechaza escuadras vacías y duplicadas', async ({ page }) => {
  126 |   await abrir(page, '/inicio');
  127 |   const input = page.getByPlaceholder('Nombre de la escuadra (ej: RRMS, ANK, ATL)');
  128 |   await input.fill('   ');
  129 |   await page.getByRole('button', { name: '+ Agregar' }).click();
  130 |   await expect(page.locator('.tabla-escuadras')).toHaveCount(0);
  131 | 
  132 |   await input.fill('RRMS');
  133 |   await input.press('Enter');
  134 |   let dialogo = '';
  135 |   page.once('dialog', d => { dialogo = d.message(); d.accept(); });
  136 |   await input.fill('rrms'); // mismo nombre en minúsculas
  137 |   await input.press('Enter');
  138 |   await expect(page.locator('.tabla-escuadras tbody tr')).toHaveCount(1);
  139 |   expect(dialogo).toContain('ya está en la lista');
  140 | });
  141 | 
  142 | test('REQ-09 Técnica solo acepta calificaciones de 1 a 10', async ({ page }) => {
  143 |   await abrir(page, '/tecnica');
  144 |   const fila = page.locator('.tabla-tecnica tbody tr').nth(0);
  145 |   const celdas = fila.locator('input');
  146 |   // Caso A: un valor mayor a 10 (15) con el resto en 10 -> el total no debe pasar de 50
  147 |   await celdas.nth(0).fill('15');
  148 |   for (let i = 1; i < 5; i++) await celdas.nth(i).fill('10');
  149 |   const totalA = Number((await fila.locator('.total').innerText()).split('/')[0]);
  150 |   // Caso B: un valor negativo (-3) -> no debe aceptarse
  151 |   await celdas.nth(1).fill('-3');
  152 |   const valorB = Number(await celdas.nth(1).inputValue());
  153 |   expect.soft(totalA, 'Total con una calificación de 15').toBeLessThanOrEqual(50);
  154 |   expect.soft(valorB, 'Valor capturado al escribir -3').toBeGreaterThanOrEqual(1);
  155 | });
  156 | 
  157 | test('REQ-10 Juegos no permite crear un juego sin nombre o con valor ≤ 0', async ({ page }) => {
  158 |   await abrir(page, '/juegos');
  159 |   await page.getByPlaceholder('Valor (pts)').fill('10');
  160 |   await page.getByRole('button', { name: '+ Agregar' }).click(); // sin nombre
  161 |   await page.getByPlaceholder('Nombre del juego (ej. Tiro al blanco)').fill('Carrera');
  162 |   await page.getByPlaceholder('Valor (pts)').fill('0');
  163 |   await page.getByRole('button', { name: '+ Agregar' }).click(); // valor 0
  164 |   await expect(page.locator('.tab-juego')).toHaveCount(0);
  165 | });
  166 | 
  167 | // ──────────────────────── Persistencia / consistencia ───────────────────────
  168 | 
  169 | test('REQ-11 Los datos guardados se conservan al recargar la página', async ({ page }) => {
  170 |   await abrir(page, '/inicio');
  171 |   const input = page.getByPlaceholder('Nombre de la escuadra (ej: RRMS, ANK, ATL)');
  172 |   await input.fill('SMN');
  173 |   await input.press('Enter');
  174 |   await page.getByRole('button', { name: '💾 Guardar' }).click();
  175 |   await expect(page.getByText('Escuadras guardadas correctamente')).toBeVisible();
  176 |   await page.reload();
  177 |   await page.waitForLoadState('domcontentloaded');
  178 |   await expect(page.locator('.tabla-escuadras tbody tr')).toContainText('SMN');
  179 | });
  180 | 
  181 | test('REQ-12 Al quitar la escuadra ganadora de un enfrentamiento se anulan sus puntos', async ({ page }) => {
  182 |   await abrir(page, '/juegos');
  183 |   await page.getByPlaceholder('Nombre del juego (ej. Tiro al blanco)').fill('Relevos');
  184 |   await page.getByPlaceholder('Valor (pts)').fill('20');
  185 |   await page.getByRole('button', { name: '+ Agregar' }).click();
  186 |   await page.getByRole('button', { name: '+ Agregar rol' }).click();
  187 |   await page.getByRole('button', { name: '+ Enfrentamiento' }).click();
  188 |   await page.getByRole('button', { name: '+ escuadra' }).click();
  189 |   const selects = page.locator('.escuadra-select select');
  190 |   await selects.nth(0).selectOption('RRMS');
  191 |   await selects.nth(1).selectOption('ANK');
  192 |   await selects.nth(2).selectOption('ATL');
  193 |   await page.locator('.ganador-select select').selectOption('ANK');
  194 |   await expect(page.locator('.ranking-item').first()).toContainText('ANK');
  195 |   // Se elimina ANK (la ganadora) del enfrentamiento
  196 |   await page.locator('.escuadra-select').nth(1).locator('.btn-quitar').click();
  197 |   await expect(page.locator('.escuadra-select select')).toHaveCount(2);
  198 |   // Esperado: ANK ya no participa, por lo tanto no debe conservar los 20 pts
  199 |   await expect(page.getByText('Puntos acumulados en juegos')).toHaveCount(0);
  200 | });
  201 | 
  202 | test('REQ-13 Eliminar una escuadra la quita y renumera la tabla', async ({ page }) => {
  203 |   await abrir(page, '/inicio');
  204 |   const input = page.getByPlaceholder('Nombre de la escuadra (ej: RRMS, ANK, ATL)');
  205 |   for (const n of ['RRMS', 'ANK', 'ATL']) { await input.fill(n); await input.press('Enter'); }
  206 |   await page.locator('.tabla-escuadras tbody tr').nth(1).getByRole('button', { name: 'Eliminar' }).click();
  207 |   const filas = page.locator('.tabla-escuadras tbody tr');
  208 |   await expect(filas).toHaveCount(2);
  209 |   await expect(filas.nth(1)).toContainText('ATL');
  210 |   await expect(filas.nth(1).locator('.num-badge')).toHaveText('2');
  211 |   await expect(page.locator('.tabla-escuadras')).not.toContainText('ANK');
  212 | });
  213 | 
  214 | // ────────────────────── Navegación, roles y permisos ────────────────────────
  215 | 
  216 | test('REQ-14 Las pantallas internas exigen sesión iniciada', async ({ page }) => {
  217 |   for (const ruta of ['/inicio', '/formacion', '/juegos', '/tecnica', '/lugares']) {
  218 |     await page.goto(ruta);
  219 |     await page.waitForLoadState('domcontentloaded');
> 220 |     await expect(page, `Acceso sin login a ${ruta}`).toHaveURL(/\/login$/);
      |                                                      ^ Error: Acceso sin login a /inicio
  221 |   }
  222 | });
  223 | 
  224 | test('REQ-15 El buscador lleva a la pantalla del resultado seleccionado', async ({ page }) => {
  225 |   // Se simula la respuesta del backend con los mismos documentos que siembra elastic-client.ts
  226 |   await page.route('**/api/buscar**', r => r.fulfill({
  227 |     json: [{ title: 'Acerca de', description: 'Quiénes somos y ubicación', route: '/acerca-de', type: 'página' }],
  228 |   }));
  229 |   await abrir(page, '/inicio');
  230 |   await page.locator('.search-btn').click();
  231 |   const respuesta = page.waitForResponse('**/api/buscar**');
  232 |   await page.locator('.search-input').fill('acerca');
  233 |   await respuesta;
  234 |   // a) Al llegar la respuesta, el resultado debe mostrarse sin más interacción
  235 |   await expect.soft(page.locator('.search-item'), 'Resultados visibles tras la respuesta').toHaveCount(1);
  236 |   // b) Se fuerza otro evento para poder seguir probando la navegación
  237 |   await page.locator('.search-input').press('End');
  238 |   await page.locator('.search-input').pressSequentially(' ');
  239 |   await page.locator('.search-item').first().click();
  240 |   await expect(page, 'Destino del resultado "Acerca de"').toHaveURL(/\/acerca$/);
  241 | });
  242 | 
  243 | test('REQ-16 El enlace de sesión solo funciona una vez', async ({ page }) => {
  244 |   const codigo = `PRUEBA-${Date.now()}`;
  245 |   await page.goto(`/sesion/${codigo}`);
  246 |   await expect(page.getByRole('heading', { name: '✅ Sesión iniciada' })).toBeVisible();
  247 |   await page.goto(`/sesion/${codigo}`);
  248 |   await expect(page.getByRole('heading', { name: '⛔ Enlace ya utilizado' })).toBeVisible();
  249 | });
  250 | 
  251 | // ───────────────────────────── Manejo de errores ────────────────────────────
  252 | 
  253 | test('REQ-17 Si el servicio de búsqueda falla, se informa al usuario', async ({ page }) => {
  254 |   await page.route('**/api/buscar**', r => r.fulfill({ status: 500, json: { error: 'Error al buscar' } }));
  255 |   await abrir(page, '/inicio');
  256 |   await page.locator('.search-btn').click();
  257 |   const respuesta = page.waitForResponse('**/api/buscar**');
  258 |   await page.locator('.search-input').fill('juegos');
  259 |   await respuesta;
  260 |   await page.waitForTimeout(500);
  261 |   // Esperado: un mensaje de error, no "Sin resultados" (que engaña al usuario)
  262 |   await expect(page.locator('.search-results')).not.toContainText('Sin resultados');
  263 | });
  264 | 
  265 | test('REQ-18 La API de notificaciones acepta una petición JSON válida', async ({ request }) => {
  266 |   const res = await request.post('/api/notificaciones/tecnica', {
  267 |     data: { escuadra: 'ATL', puntos: 45 },
  268 |   });
  269 |   expect(res.status()).toBe(200);
  270 |   expect(await res.json()).toEqual({ ok: true });
  271 | });
```