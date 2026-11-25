// PRÁCTICA 12 · Profiling de la app (antes vs. después) con Chrome DevTools Protocol.
// Misma app compilada para producción, mismo Supabase simulado con latencia fija,
// CPU limitada ×4 (aprox. celular de gama media). Uso: node perfil.cjs <antes|despues> <puerto>
const { chromium } = require('playwright');
const crearMock = require('./mock.cjs');
const VERSION = process.argv[2], BASE = `http://localhost:${process.argv[3]}`, CORRIDA = process.argv[4] ?? '1';
const LATENCIA = 100;   // ms por petición ≈ latencia medida a Supabase con conexión reutilizada (105.7 ms, P11)
const r1 = n => Math.round(n * 10) / 10;
const resumen = a => ({ n: a.length, prom: r1(a.reduce((x, y) => x + y, 0) / a.length), min: r1(Math.min(...a)), max: r1(Math.max(...a)) });

(async () => {
  const mock = crearMock(LATENCIA);
  const { db, estado } = mock;
  db.escuadras.push({ id: 4, nombre: 'MNS', activa: true }, { id: 5, nombre: 'SMN', activa: true }, { id: 6, nombre: 'SJN', activa: true });
  db.sesion_escuadras.push(...[4, 5, 6].map(e => ({ sesion_id: 1, escuadra_id: e })));

  const b = await chromium.launch();
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });
  await ctx.route('https://berxzmxipyapcczfwynl.supabase.co/rest/v1/**', mock.rest);
  await ctx.route('https://berxzmxipyapcczfwynl.supabase.co/auth/v1/**', r => r.fulfill({ json: { id: 'u1' } }));
  await ctx.route('https://berxzmxipyapcczfwynl.supabase.co/realtime/**', r => r.abort());
  await ctx.route('**/api/**', r => r.fulfill({ json: { ok: true } }));
  await ctx.addInitScript(() => {
    const a = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-berxzmxipyapcczfwynl-auth-token', JSON.stringify({ access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: a + 3600, user: { id: 'u1', aud: 'authenticated', email: 'j@x.com', app_metadata: {}, user_metadata: {}, created_at: '' } }));
    window.__largas = [];
    new PerformanceObserver(l => l.getEntries().forEach(e => window.__largas.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Performance.enable');
  const metricas = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));

  // Muestreo de memoria y CPU cada 250 ms durante toda la sesión
  const muestras = [];
  const inicio = await metricas(), tInicio = Date.now();
  let previo = inicio, tPrevio = Date.now(), muestreando = true;
  const muestreo = (async () => {
    while (muestreando) {
      await new Promise(r => setTimeout(r, 250));
      try {
        const m = await metricas(), t = Date.now();
        muestras.push({ heapMB: m.JSHeapUsedSize / 2 ** 20, cpu: Math.min(100, (m.TaskDuration - previo.TaskDuration) / ((t - tPrevio) / 1000) * 100) });
        previo = m; tPrevio = t;
      } catch { /* página navegando */ }
    }
  })();

  const R = { version: VERSION, latenciaMs: LATENCIA, cpu: '×4', pruebas: {} };
  const listoJuegos = () => p.waitForFunction(() => document.querySelector('input[placeholder^="Nombre del juego"]') && !document.querySelector('.msg-cargando'), null, { timeout: 30000 });

  // ── 1. Consulta repetida: abrir Juegos 10 veces
  const consulta = [], petConsulta = [];
  for (let i = 0; i < 10; i++) {
    const n0 = estado.peticiones, t = Date.now();
    await p.goto(BASE + '/juegos'); await listoJuegos();
    consulta.push(Date.now() - t); petConsulta.push(estado.peticiones - n0);
  }
  R.pruebas.consultaRepetida = { ms: consulta, ...resumen(consulta), peticionesPorCarga: petConsulta.at(-1) };
  const heapInicial = muestras.at(-1)?.heapMB;

  // ── 2. Escritura: guardar con 1, 2, 3, 4 y 5 juegos (cada juego: 2 roles × 2 enfrentamientos, con ganador)
  const escritura = [];
  for (let k = 1; k <= 5; k++) {
    await p.fill('input[placeholder^="Nombre del juego"]', `Juego ${k}`);
    await p.fill('input[placeholder="Valor (pts)"]', String(10 * k));
    await p.click('text=+ Agregar');
    for (let r = 0; r < 2; r++) {
      await p.click('text=+ Agregar rol');
      for (let e = 0; e < 2; e++) {
        await p.locator('.rol-card').nth(r).locator('text=+ Enfrentamiento').click();
        const enf = p.locator('.rol-card').nth(r).locator('.enfrentamiento').nth(e);
        const sel = enf.locator('.escuadra-select select');
        const pares = [['RRMS', 'ANK'], ['ATL', 'MNS'], ['SMN', 'SJN'], ['ANK', 'ATL']];
        const [a, c] = pares[(r * 2 + e) % 4];
        await sel.nth(0).selectOption(a); await sel.nth(1).selectOption(c);
        await enf.locator('.ganador-select select').selectOption(a);
      }
    }
    const n0 = estado.peticiones, t = Date.now();
    await p.click('.btn-guardar');
    await p.waitForSelector('.msg-guardado', { timeout: 60000 });
    escritura.push({ juegos: k, ms: Date.now() - t, peticiones: estado.peticiones - n0 });
    await p.waitForSelector('.msg-guardado', { state: 'detached', timeout: 10000 });
  }
  R.pruebas.escritura = escritura;
  R.pruebas.integridad = { juegos: db.juegos.length, enfrentamientos: db.enfrentamientos.length, participaciones: db.enfrentamiento_escuadras.length };

  // ── 3. Navegación entre las pantallas principales (3 vueltas, rutas internas)
  const pantallas = [['Inicio', '.container'], ['Formación', 'select'], ['Juegos', 'input[placeholder^="Nombre del juego"]'], ['Técnica', 'input[type=number], table'], ['Lugares', '.tabla-lugares'], ['Estadísticas', '.barra-col']];
  const nav = {};
  for (let v = 0; v < 3; v++) for (const [nombre, sel] of pantallas) {
    const t = Date.now();
    await p.locator('.nav-tab', { hasText: nombre }).first().click();
    await p.waitForSelector(sel, { state: 'attached', timeout: 30000 });
    await p.waitForFunction(() => !/Cargando/.test(document.body.innerText), null, { timeout: 30000 });
    (nav[nombre] ??= []).push(Date.now() - t);
  }
  R.pruebas.navegacion = Object.fromEntries(Object.entries(nav).map(([k, v]) => [k, resumen(v)]));

  // ── 4. Procesamiento de datos: un juego con 40 enfrentamientos; cambiar el ganador 20 veces
  const nombres = ['RRMS', 'ANK', 'ATL', 'MNS', 'SMN', 'SJN'];
  const jg = { id: 9000, sesion_id: 1, nombre: 'Torneo', valor: 5, id_cliente: '00000000-0000-4000-8000-000000009000' }; db.juegos.push(jg);
  for (let i = 0; i < 40; i++) {
    const en = { id: 9100 + i, juego_id: 9000, rol: 1 + Math.floor(i / 10), ganador_id: 1 + (i % 6) }; db.enfrentamientos.push(en);
    db.enfrentamiento_escuadras.push({ enfrentamiento_id: en.id, escuadra_id: 1 + (i % 6) }, { enfrentamiento_id: en.id, escuadra_id: 1 + ((i + 1) % 6) });
  }
  await p.goto(BASE + '/juegos'); await listoJuegos();
  await p.locator('.tab-juego', { hasText: 'Torneo' }).click();
  await p.waitForFunction(() => document.querySelectorAll('.enfrentamiento').length >= 40, null, { timeout: 30000 });
  const m0 = await metricas();
  const clics = [];
  for (let i = 0; i < 20; i++) {
    const ms = await p.evaluate(async (i) => {
      const sel = document.querySelectorAll('.ganador-select select')[i];
      const opciones = [...sel.options].filter(o => o.value && !o.disabled).map(o => o.value);
      const antes = document.querySelector('.ranking-lista')?.innerText;
      const t = performance.now();
      sel.value = opciones.find(o => o !== sel.value) ?? opciones[0];
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      for (let k = 0; k < 60 && document.querySelector('.ranking-lista')?.innerText === antes; k++) await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      return performance.now() - t;
    }, i);
    clics.push(ms);
  }
  const m1 = await metricas();
  R.pruebas.procesamiento = { enfrentamientos: 40, cambios: 20, msPorCambio: resumen(clics), scriptMs: r1((m1.ScriptDuration - m0.ScriptDuration) * 1000), tareasMs: r1((m1.TaskDuration - m0.TaskDuration) * 1000) };

  muestreando = false; await muestreo;
  const heap = muestras.map(m => m.heapMB), cpu = muestras.map(m => m.cpu);
  R.memoria = { inicialMB: r1(heapInicial ?? heap[0]), maximaMB: r1(Math.max(...heap)), finalMB: r1(heap.at(-1)) };
  R.cpu = { promedioPct: r1(cpu.reduce((a, c) => a + c, 0) / cpu.length), maximoPct: r1(Math.max(...cpu)), muestras: cpu.length };
  const fin = await metricas();
  R.cpuTotal = { segundosHiloPrincipal: r1(fin.TaskDuration - inicio.TaskDuration), segundosScript: r1(fin.ScriptDuration - inicio.ScriptDuration), duracionSesionS: r1((Date.now() - tInicio) / 1000) };
  R.tareasLargas = await p.evaluate(() => ({ n: window.__largas.length, maxMs: Math.max(0, ...window.__largas) }));
  R.peticionesTotales = estado.peticiones;
  require('fs').writeFileSync(`${__dirname}/perfil-${VERSION}-${CORRIDA}.json`, JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
