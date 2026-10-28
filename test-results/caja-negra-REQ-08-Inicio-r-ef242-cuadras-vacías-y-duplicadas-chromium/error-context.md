# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: caja-negra.spec.ts >> REQ-08 Inicio rechaza escuadras vacías y duplicadas
- Location: e2e\caja-negra.spec.ts:125:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.tabla-escuadras tbody tr')
Expected: 1
Received: 2
Timeout:  15000ms

Call log:
  - Expect "toHaveCount" locator('.tabla-escuadras tbody tr') with timeout 15000ms
  - waiting for locator('.tabla-escuadras tbody tr')
    33 × locator resolved to 2 elements
       - unexpected value "2"

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
      - heading "Escuadrón Moriah" [level=2] [ref=e20]
      - paragraph [ref=e21]: La forma más rápida y justa de llevar el control de juegos, técnica, formación y el ranking general de tu escuadrón. Registra, califica y consulta resultados en tiempo real, sin hojas de papel ni cálculos a mano.
    - img "Escuadrón Moriah" [ref=e23]
  - generic [ref=e24]:
    - generic [ref=e25]:
      - heading "PUNTUACIONES" [level=1] [ref=e26]
      - generic [ref=e27]:
        - generic [ref=e28]: "FECHA:"
        - textbox [ref=e29]: 2026-10-23
    - generic [ref=e30]:
      - heading "Agregar Escuadra" [level=3] [ref=e31]
      - generic [ref=e32]:
        - 'textbox "Nombre de la escuadra (ej: RRMS, ANK, ATL)" [active] [ref=e33]'
        - button "+ Agregar" [ref=e34] [cursor=pointer]
        - button "💾 Guardar" [ref=e35] [cursor=pointer]
    - generic [ref=e36]:
      - heading "Escuadras registradas" [level=3] [ref=e37]
      - table [ref=e38]:
        - rowgroup [ref=e39]:
          - row [ref=e40]:
            - columnheader "#" [ref=e41]
            - columnheader "Nombre" [ref=e42]
            - columnheader "Acciones" [ref=e43]
        - rowgroup [ref=e44]:
          - row [ref=e45]:
            - cell "1" [ref=e46]
            - cell "RR RRMS" [ref=e48]:
              - generic [ref=e49]:
                - generic [ref=e50]: RR
                - generic [ref=e51]: RRMS
            - cell [ref=e52]:
              - button "Eliminar" [ref=e53] [cursor=pointer]
          - row [ref=e54]:
            - cell "2" [ref=e55]
            - cell "RR rrms" [ref=e57]:
              - generic [ref=e58]:
                - generic [ref=e59]: RR
                - generic [ref=e60]: rrms
            - cell [ref=e61]:
              - button "Eliminar" [ref=e62] [cursor=pointer]
    - generic [ref=e65]:
      - generic [ref=e66]: RRMS
      - generic [ref=e67]:
        - generic [ref=e68]: "12"
        - generic [ref=e69]: miembros
      - generic [ref=e70]:
        - generic [ref=e71]: "85"
        - generic [ref=e72]: puntos
      - generic [ref=e73]: ⚠ Adeudo pendiente
      - button "Enviar al reloj" [ref=e75] [cursor=pointer]
  - contentinfo [ref=e77]:
    - generic [ref=e78]:
      - generic [ref=e79]:
        - heading "Escuadrón Moriah" [level=3] [ref=e80]
        - paragraph [ref=e81]: escuadron.moriah@gmail.com
        - generic [ref=e82]:
          - link "Facebook" [ref=e83] [cursor=pointer]:
            - /url: https://www.facebook.com/EscuadronMoriah
          - link "Instagram" [ref=e86] [cursor=pointer]:
            - /url: https://www.instagram.com/escuadron_moriah?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==
      - generic [ref=e89]:
        - heading "Contáctanos" [level=4] [ref=e90]
        - generic [ref=e91]:
          - textbox "Tu nombre" [ref=e92]
          - textbox "Tu correo" [ref=e93]
          - textbox "Mensaje" [ref=e94]
          - button "Enviar" [ref=e95] [cursor=pointer]
    - paragraph [ref=e96]: Derechos reservados © 2026 · Escuadrón Moriah
```

# Test source

```ts
  38  |   await input.fill('MNS');
  39  |   await input.press('Enter');
  40  |   const filas = page.locator('.tabla-escuadras tbody tr');
  41  |   await expect(filas).toHaveCount(2);
  42  |   await expect(filas.nth(0)).toContainText('ATL');
  43  |   await expect(filas.nth(1)).toContainText('MNS');
  44  |   await expect(input).toHaveValue('');
  45  | });
  46  | 
  47  | test('REQ-03 Formación calcula correctamente los puntos de la escuadra', async ({ page }) => {
  48  |   await abrir(page, '/formacion');
  49  |   await page.locator('select').first().selectOption('RRMS');
  50  |   const filas = page.locator('.tabla-formacion tbody tr');
  51  |   // 2 miembros con uniforme -> 20 pts
  52  |   for (const i of [0, 1]) {
  53  |     await filas.nth(i).locator('input[type=text]').first().fill(`Miembro ${i + 1}`);
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
> 138 |   await expect(page.locator('.tabla-escuadras tbody tr')).toHaveCount(1);
      |                                                           ^ Error: expect(locator).toHaveCount(expected) failed
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
```