# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: caja-negra.spec.ts >> REQ-09 Técnica solo acepta calificaciones de 1 a 10
- Location: e2e\caja-negra.spec.ts:142:5

# Error details

```
Error: Total con una calificación de 15

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 50
Received:    55
```

```
Error: Valor capturado al escribir -3

expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 1
Received:    -3
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
      - heading "Técnica" [level=1] [ref=e20]
      - paragraph [ref=e21]: Califica la estructura de cada escuadra del 1 al 10 por criterio
    - img "Prueba técnica" [ref=e23]
    - generic [ref=e24]:
      - table [ref=e25]:
        - rowgroup [ref=e26]:
          - row [ref=e27]:
            - columnheader "Escuadra" [ref=e28]
            - columnheader "Fuerza" [ref=e29]
            - columnheader "Utilidad" [ref=e30]
            - columnheader "Firmeza" [ref=e31]
            - columnheader "Estabilidad" [ref=e32]
            - columnheader "Originalidad" [ref=e33]
            - columnheader "Total" [ref=e34]
        - rowgroup [ref=e35]:
          - row [ref=e36]:
            - cell "RR RRMS" [ref=e37]:
              - generic [ref=e38]: RR
              - text: RRMS
            - cell [ref=e39]:
              - spinbutton [ref=e40]: "15"
            - cell [ref=e41]:
              - spinbutton [active] [ref=e42]: "-3"
            - cell [ref=e43]:
              - spinbutton [ref=e44]: "10"
            - cell [ref=e45]:
              - spinbutton [ref=e46]: "10"
            - cell [ref=e47]:
              - spinbutton [ref=e48]: "10"
            - cell "42/50" [ref=e49]
          - row [ref=e50]:
            - cell "AN ANK" [ref=e51]:
              - generic [ref=e52]: AN
              - text: ANK
            - cell [ref=e53]:
              - spinbutton [ref=e54]: "0"
            - cell [ref=e55]:
              - spinbutton [ref=e56]: "0"
            - cell [ref=e57]:
              - spinbutton [ref=e58]: "0"
            - cell [ref=e59]:
              - spinbutton [ref=e60]: "0"
            - cell [ref=e61]:
              - spinbutton [ref=e62]: "0"
            - cell "0/50" [ref=e63]
          - row [ref=e64]:
            - cell "AT ATL" [ref=e65]:
              - generic [ref=e66]: AT
              - text: ATL
            - cell [ref=e67]:
              - spinbutton [ref=e68]: "0"
            - cell [ref=e69]:
              - spinbutton [ref=e70]: "0"
            - cell [ref=e71]:
              - spinbutton [ref=e72]: "0"
            - cell [ref=e73]:
              - spinbutton [ref=e74]: "0"
            - cell [ref=e75]:
              - spinbutton [ref=e76]: "0"
            - cell "0/50" [ref=e77]
      - heading "Foto de la técnica" [level=3] [ref=e78]
      - paragraph [ref=e79]: Toma una foto de la estructura de cada escuadra al calificarla.
      - generic [ref=e80]:
        - generic [ref=e81]:
          - generic [ref=e82]:
            - generic [ref=e83]: RR
            - text: RRMS
          - generic [ref=e84]: Sin foto
          - button "📷 Tomar foto" [ref=e87] [cursor=pointer]
        - generic [ref=e88]:
          - generic [ref=e89]:
            - generic [ref=e90]: AN
            - text: ANK
          - generic [ref=e91]: Sin foto
          - button "📷 Tomar foto" [ref=e94] [cursor=pointer]
        - generic [ref=e95]:
          - generic [ref=e96]:
            - generic [ref=e97]: AT
            - text: ATL
          - generic [ref=e98]: Sin foto
          - button "📷 Tomar foto" [ref=e101] [cursor=pointer]
      - button "💾 Guardar calificaciones" [ref=e103] [cursor=pointer]
    - generic [ref=e104]:
      - heading "Ranking actual" [level=3] [ref=e105]
      - generic [ref=e106]:
        - generic [ref=e107]:
          - generic [ref=e108]: 1°
          - generic [ref=e109]: RR
          - generic [ref=e110]: RRMS
          - generic [ref=e113]: 42 pts
        - generic [ref=e114]:
          - generic [ref=e115]: 2°
          - generic [ref=e116]: AN
          - generic [ref=e117]: ANK
          - generic [ref=e119]: 0 pts
        - generic [ref=e120]:
          - generic [ref=e121]: 3°
          - generic [ref=e122]: AT
          - generic [ref=e123]: ATL
          - generic [ref=e125]: 0 pts
  - contentinfo [ref=e127]:
    - generic [ref=e128]:
      - generic [ref=e129]:
        - heading "Escuadrón Moriah" [level=3] [ref=e130]
        - paragraph [ref=e131]: escuadron.moriah@gmail.com
        - generic [ref=e132]:
          - link "Facebook" [ref=e133] [cursor=pointer]:
            - /url: https://www.facebook.com/EscuadronMoriah
          - link "Instagram" [ref=e136] [cursor=pointer]:
            - /url: https://www.instagram.com/escuadron_moriah?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==
      - generic [ref=e139]:
        - heading "Contáctanos" [level=4] [ref=e140]
        - generic [ref=e141]:
          - textbox "Tu nombre" [ref=e142]
          - textbox "Tu correo" [ref=e143]
          - textbox "Mensaje" [ref=e144]
          - button "Enviar" [ref=e145] [cursor=pointer]
    - paragraph [ref=e146]: Derechos reservados © 2026 · Escuadrón Moriah
```

# Test source

```ts
  54  |     await filas.nth(i).locator('input[type=checkbox]').check();
  55  |   }
  56  |   await page.getByLabel('Uniforme del jefe/subjefe (10 pts)').check(); // +10
  57  |   await page.getByLabel('Bandera (5 pts)').check();                     // +5
  58  |   await page.getByLabel('Biblia (5 pts)').check();                      // +5
  59  |   const mats = page.locator('.mat-row input[type=number]');
  60  |   await mats.nth(0).fill('1'); // técnica  +10
  61  |   await mats.nth(1).fill('1'); // quizz    +10
  62  |   // Esperado: 30 (uniformes) + 20 (materiales) + 10 (accesorios) = 60
  63  |   await expect(page.locator('.total-grande')).toHaveText('60');
  64  | });
  65  | 
  66  | test('REQ-04 Técnica suma los 5 criterios y ordena el ranking', async ({ page }) => {
  67  |   await abrir(page, '/tecnica');
  68  |   const rrms = page.locator('.tabla-tecnica tbody tr').nth(0).locator('input');
  69  |   const notas = ['8', '7', '9', '6', '10'];
  70  |   for (let i = 0; i < 5; i++) await rrms.nth(i).fill(notas[i]);
  71  |   const ank = page.locator('.tabla-tecnica tbody tr').nth(1).locator('input');
  72  |   for (let i = 0; i < 5; i++) await ank.nth(i).fill('9');
  73  |   await expect(page.locator('.tabla-tecnica tbody tr').nth(0).locator('.total')).toContainText('40');
  74  |   await expect(page.locator('.tabla-tecnica tbody tr').nth(1).locator('.total')).toContainText('45');
  75  |   const ranking = page.locator('.ranking-item');
  76  |   await expect(ranking.nth(0)).toContainText('ANK');
  77  |   await expect(ranking.nth(1)).toContainText('RRMS');
  78  | });
  79  | 
  80  | test('REQ-05 Juegos asigna el valor del juego a la escuadra ganadora', async ({ page }) => {
  81  |   await abrir(page, '/juegos');
  82  |   await page.getByPlaceholder('Nombre del juego (ej. Tiro al blanco)').fill('Tiro al blanco');
  83  |   await page.getByPlaceholder('Valor (pts)').fill('15');
  84  |   await page.getByRole('button', { name: '+ Agregar' }).click();
  85  |   await page.getByRole('button', { name: '+ Agregar rol' }).click();
  86  |   await page.getByRole('button', { name: '+ Enfrentamiento' }).click();
  87  |   const selects = page.locator('.escuadra-select select');
  88  |   await selects.nth(0).selectOption('RRMS');
  89  |   await selects.nth(1).selectOption('ANK');
  90  |   await page.locator('.ganador-select select').selectOption('ANK');
  91  |   const item = page.locator('.ranking-item').first();
  92  |   await expect(item).toContainText('ANK');
  93  |   await expect(item).toContainText('15 pts');
  94  | });
  95  | 
  96  | test('REQ-06 Lugares muestra el podio ordenado por puntaje total', async ({ page }) => {
  97  |   await abrir(page, '/lugares');
  98  |   await expect(page.locator('.podio-card.oro .podio-nombre')).toHaveText('ATL');
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
> 154 |   expect.soft(valorB, 'Valor capturado al escribir -3').toBeGreaterThanOrEqual(1);
      |                                                         ^ Error: Valor capturado al escribir -3
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
```