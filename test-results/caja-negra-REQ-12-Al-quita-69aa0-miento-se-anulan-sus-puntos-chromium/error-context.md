# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: caja-negra.spec.ts >> REQ-12 Al quitar la escuadra ganadora de un enfrentamiento se anulan sus puntos
- Location: e2e\caja-negra.spec.ts:181:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByText('Puntos acumulados en juegos')
Expected: 0
Received: 1
Timeout:  15000ms

Call log:
  - Expect "toHaveCount" getByText('Puntos acumulados en juegos') with timeout 15000ms
  - waiting for getByText('Puntos acumulados en juegos')
    33 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e5]:
    - img "Logo" [ref=e6]
    - generic [ref=e7]:
      - button "Inicio" [ref=e8] [cursor=pointer]
      - button "Formación" [ref=e9] [cursor=pointer]
      - button "Juegos" [ref=e10] [cursor=pointer]
      - button "Técnica" [ref=e11] [cursor=pointer]
      - button "Lugares" [ref=e12] [cursor=pointer]
      - button "Acerca" [ref=e13] [cursor=pointer]
      - button "Estadísticas" [ref=e14] [cursor=pointer]
      - button "Sesion" [ref=e15] [cursor=pointer]
    - button "🔍" [ref=e17] [cursor=pointer]
  - generic [ref=e18]:
    - generic [ref=e19]:
      - heading "Juegos" [level=1] [ref=e20]
      - paragraph [ref=e21]: Agrega juegos, define roles y registra los ganadores de cada enfrentamiento
    - generic [ref=e22]:
      - heading "Agregar juego" [level=3] [ref=e23]
      - generic [ref=e24]:
        - textbox "Nombre del juego (ej. Tiro al blanco)" [ref=e25]
        - spinbutton "Valor (pts)" [ref=e26]: "0"
        - button "+ Agregar" [ref=e27] [cursor=pointer]
    - button "Relevos 20 pts" [ref=e29] [cursor=pointer]:
      - text: Relevos
      - generic [ref=e30]: 20 pts
    - generic [ref=e31]:
      - generic [ref=e32]:
        - heading "Relevos" [level=3] [ref=e33]
        - generic [ref=e34]: 20 pts por ganador
        - button "+ Agregar rol" [ref=e35] [cursor=pointer]
      - generic [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e39]: Rol 1
          - button "+ Enfrentamiento" [ref=e40] [cursor=pointer]
          - button "✕" [ref=e41] [cursor=pointer]
        - generic [ref=e43]:
          - generic [ref=e44]:
            - combobox [ref=e46]:
              - option "-- Escuadra --"
              - option "RRMS" [selected]
              - option "ANK"
              - option "ATL"
              - option "MNS"
              - option "SMN"
              - option "SJN"
            - combobox [ref=e48]:
              - option "-- Escuadra --"
              - option "RRMS"
              - option "ANK"
              - option "ATL" [selected]
              - option "MNS"
              - option "SMN"
              - option "SJN"
            - button "+ escuadra" [ref=e49] [cursor=pointer]
          - generic [ref=e50]:
            - generic [ref=e51]: "Ganador:"
            - combobox [ref=e52]:
              - option "-- Sin definir --"
              - option "RRMS"
              - option "ATL"
          - button "Eliminar" [ref=e53] [cursor=pointer]
      - button "💾 Guardar" [ref=e55] [cursor=pointer]
    - generic [ref=e56]:
      - heading "Puntos acumulados en juegos" [level=3] [ref=e57]
      - generic [ref=e59]:
        - generic [ref=e60]: 1°
        - generic [ref=e61]: AN
        - generic [ref=e62]: ANK
        - generic [ref=e65]: 20 pts
  - contentinfo [ref=e67]:
    - generic [ref=e68]:
      - generic [ref=e69]:
        - heading "Escuadrón Moriah" [level=3] [ref=e70]
        - paragraph [ref=e71]: escuadron.moriah@gmail.com
        - generic [ref=e72]:
          - link "Facebook" [ref=e73] [cursor=pointer]:
            - /url: https://www.facebook.com/EscuadronMoriah
          - link "Instagram" [ref=e76] [cursor=pointer]:
            - /url: https://www.instagram.com/escuadron_moriah?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==
      - generic [ref=e79]:
        - heading "Contáctanos" [level=4] [ref=e80]
        - generic [ref=e81]:
          - textbox "Tu nombre" [ref=e82]
          - textbox "Tu correo" [ref=e83]
          - textbox "Mensaje" [ref=e84]
          - button "Enviar" [ref=e85] [cursor=pointer]
    - paragraph [ref=e86]: Derechos reservados © 2026 · Escuadrón Moriah
```

# Test source

```ts
  99  |   await expect(page.locator('.podio-card.oro .podio-pts')).toHaveText('175 pts');
  100 |   await expect(page.locator('.podio-card.plata .podio-nombre')).toHaveText('RRMS');
  101 |   await expect(page.locator('.podio-card.bronce .podio-nombre')).toHaveText('SJN');
  102 | });
  103 | 
  104 | // ───────────────────────────────── Validaciones ─────────────────────────────
  105 | 
  106 | test('REQ-07 Login rechaza entradas inválidas con mensajes claros', async ({ page }) => {
  107 |   await abrir(page, '/login');
  108 |   const alerta = page.getByRole('alert');
  109 | 
  110 |   await page.click('button.entrar'); // campos vacíos
  111 |   await expect(alerta).toHaveText('Ingresa tu usuario y contraseña.');
  112 | 
  113 |   await page.fill('#usuario', 'moriah');
  114 |   await page.fill('#password', 'abc123'); // < 8 caracteres
  115 |   await page.click('button.entrar');
  116 |   await expect(alerta).toHaveText('La contraseña debe tener al menos 8 caracteres.');
  117 | 
  118 |   await page.fill('#password', 'Incorrecta99');
  119 |   await page.click('button.entrar');
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
> 199 |   await expect(page.getByText('Puntos acumulados en juegos')).toHaveCount(0);
      |                                                               ^ Error: expect(locator).toHaveCount(expected) failed
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
  220 |     await expect(page, `Acceso sin login a ${ruta}`).toHaveURL(/\/login$/);
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