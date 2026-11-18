// PRÁCTICA 12 · Fase 5: pruebas de resiliencia RES-01…RES-08 (antes vs. después)
// Fallos controlados sobre la app compilada; Supabase simulado con 100 ms de latencia.
// Uso: node resiliencia.cjs <antes|despues> <puerto>
const { chromium } = require('playwright');
const crearMock = require('./mock.cjs');
const VERSION = process.argv[2], BASE = `http://localhost:${process.argv[3]}`;
const R = { version: VERSION, escenarios: [] };

// Cada escenario usa un navegador NUEVO: las peticiones colgadas a propósito (RES-03)
// no deben ocupar conexiones de los escenarios siguientes.
async function nuevaPagina(_b, mock) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });
  const T0 = Date.now();
  await ctx.route('https://berxzmxipyapcczfwynl.supabase.co/rest/v1/**', async r => {
    if (process.env.TRAZA) console.log(((Date.now() - T0) / 1000).toFixed(1), '→', r.request().method(), r.request().url().split('/rest/v1/')[1].slice(0, 50));
    await mock.rest(r);
    if (process.env.TRAZA) console.log(((Date.now() - T0) / 1000).toFixed(1), '←');
  });
  await ctx.route('https://berxzmxipyapcczfwynl.supabase.co/auth/v1/**', r => { if (process.env.TRAZA) console.log(((Date.now() - T0) / 1000).toFixed(1), 'AUTH', r.request().url().split('/auth/v1/')[1]); return r.fulfill({ json: { id: 'u1' } }); });
  await ctx.route('https://berxzmxipyapcczfwynl.supabase.co/realtime/**', r => r.abort());
  await ctx.route('**/api/**', r => r.fulfill({ json: { ok: true } }));
  await ctx.addInitScript(() => {
    const a = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-berxzmxipyapcczfwynl-auth-token', JSON.stringify({ access_token: 'x', refresh_token: 'y', token_type: 'bearer', expires_in: 3600, expires_at: a + 3600, user: { id: 'u1', aud: 'authenticated', email: 'j@x.com', app_metadata: {}, user_metadata: {}, created_at: '' } }));
  });
  const p = await ctx.newPage();
  return { ctx: { close: () => b.close() }, p };
}
const listoJuegos = p => p.waitForFunction(() => document.querySelector('input[placeholder^="Nombre del juego"]') && !document.querySelector('.msg-cargando'), null, { timeout: 60000 });
async function crearJuego(p, nombre) {
  await p.fill('input[placeholder^="Nombre del juego"]', nombre);
  await p.fill('input[placeholder="Valor (pts)"]', '20');
  await p.click('text=+ Agregar');
  await p.click('text=+ Agregar rol');
  await p.click('text=+ Enfrentamiento');
  const sel = p.locator('.escuadra-select select');
  await sel.nth(0).selectOption('RRMS'); await sel.nth(1).selectOption('ANK');
  await p.locator('.ganador-select select').selectOption('ANK');
}
/** Pulsa Guardar otra vez y espera a que se borre el mensaje anterior antes de medir. */
async function guardarDeNuevo(p) {
  const t0 = Date.now();
  await p.click('.btn-guardar');
  await p.waitForSelector('.msg-error-guardado, .msg-guardado', { state: 'detached', timeout: 5000 }).catch(() => {});
  return t0;
}
/** Espera el primer mensaje visible (éxito, error o carga terminada) y devuelve cuánto tardó. */
async function esperarMensaje(p, t0, limiteMs) {
  try {
    await p.waitForSelector('.msg-guardado, .msg-error-guardado, .msg-estado.error', { timeout: limiteMs });
    const ms = Date.now() - t0;   // se mide en cuanto aparece el mensaje
    const exito = await p.locator('.msg-guardado').count() > 0;
    const errores = p.locator('.msg-error-guardado, .msg-estado.error');
    const texto = (await errores.count()) > 0 ? (await errores.first().textContent()) || '' : '';
    return { ms, exito, mensaje: texto.replace(/\s+/g, ' ').trim() };
  } catch {
    const boton = await p.locator('.btn-guardar').textContent().catch(() => '');
    return { ms: null, exito: false, mensaje: `sin respuesta después de ${limiteMs / 1000} s (botón: «${(boton || '').trim()}»)` };
  }
}
const contar = (mock, re) => mock.log.filter(l => re.test(l)).length;
const fila = (codigo, escenario, datos) => { R.escenarios.push({ codigo, escenario, ...datos }); console.log(codigo, JSON.stringify(datos)); };

(async () => {
  const b = await chromium.launch();

  // RES-01 · pérdida de Internet durante una consulta (abrir Lugares)
  { const mock = crearMock(100); const { ctx, p } = await nuevaPagina(b, mock);
    await p.goto(BASE + '/inicio'); await p.waitForTimeout(1500);
    mock.estado.sinRed = true; const t0 = Date.now();
    await p.locator('.nav-tab', { hasText: 'Lugares' }).first().click();
    const r = await esperarMensaje(p, t0, 45000);
    const peticiones = contar(mock, /^X GET/);
    fila('RES-01', 'Pérdida de Internet durante una consulta', { ...r, intentosGET: peticiones, appEstable: await p.locator('.nav-tab').count() > 0 });
    await ctx.close(); }

  // RES-02 + RES-06 · pérdida de Internet durante una escritura y recuperación
  { const mock = crearMock(100); const { ctx, p } = await nuevaPagina(b, mock);
    await p.goto(BASE + '/juegos'); await listoJuegos(p); await crearJuego(p, 'Relevos');
    mock.estado.sinRed = true; let t0 = Date.now();
    await p.click('.btn-guardar');
    const r = await esperarMensaje(p, t0, 60000);
    fila('RES-02', 'Pérdida de Internet durante una escritura', { ...r, confirmoFalsamente: r.exito, juegosEnBase: mock.db.juegos.length, datosEnPantalla: await p.locator('.tab-juego').count() });
    mock.estado.sinRed = false; t0 = await guardarDeNuevo(p);
    const r2 = await esperarMensaje(p, t0, 30000);
    fila('RES-06', 'Recuperación de conexión (guardar de nuevo)', { ...r2, juegosEnBase: mock.db.juegos.length, duplicados: mock.db.juegos.length - 1 });
    await ctx.close(); }

  // RES-03 · servidor sin respuesta (escritura y consulta)
  { const mock = crearMock(100); const { ctx, p } = await nuevaPagina(b, mock);
    await p.goto(BASE + '/juegos'); await listoJuegos(p); await crearJuego(p, 'Cuerda');
    mock.estado.colgar = true; const t0 = Date.now();
    await p.click('.btn-guardar');
    const reintentoVisto = p.waitForSelector('.msg-reintento', { timeout: 45000 }).then(() => Date.now() - t0).catch(() => null);
    const r = await esperarMensaje(p, t0, 45000);
    fila('RES-03a', 'Servidor sin respuesta al guardar', { ...r, avisoDeReintentoMs: await reintentoVisto });
    await ctx.close(); }
  { const mock = crearMock(100); const { ctx, p } = await nuevaPagina(b, mock);
    await p.goto(BASE + '/inicio'); await p.waitForTimeout(1500);
    mock.estado.colgar = true; const t0 = Date.now();
    await p.locator('.nav-tab', { hasText: 'Lugares' }).first().click();
    fila('RES-03b', 'Servidor sin respuesta al consultar (Lugares)', await esperarMensaje(p, t0, 45000));
    await ctx.close(); }

  // RES-04 · respuesta HTTP 500
  { const mock = crearMock(100); const { ctx, p } = await nuevaPagina(b, mock);
    await p.goto(BASE + '/juegos'); await listoJuegos(p); await crearJuego(p, 'Pañuelo');
    mock.estado.forzar = { status: 500, json: { code: 'XX000', message: 'internal server error' } }; const t0 = Date.now();
    await p.click('.btn-guardar');
    const r = await esperarMensaje(p, t0, 30000);
    mock.estado.forzar = null;
    await p.locator('.nav-tab', { hasText: 'Lugares' }).first().click();
    const sigueFuncionando = await p.waitForSelector('.tabla-lugares, .msg-estado', { timeout: 20000 }).then(() => true).catch(() => false);
    fila('RES-04', 'Respuesta HTTP 500', { ...r, confirmoFalsamente: r.exito, sigueFuncionando });
    await ctx.close(); }

  // RES-05 · 401 (sesión expirada) y 403 (sin permiso)
  for (const [codigo, status, json] of [['RES-05a', 401, { code: 'PGRST301', message: 'JWT expired' }], ['RES-05b', 403, { code: '42501', message: 'permission denied' }]]) {
    const mock = crearMock(100); const { ctx, p } = await nuevaPagina(b, mock);
    await p.goto(BASE + '/juegos'); await listoJuegos(p); await crearJuego(p, 'Bandera');
    mock.estado.forzar = { status, json }; const t0 = Date.now();
    await p.click('.btn-guardar');
    fila(codigo, `Respuesta HTTP ${status}`, await esperarMensaje(p, t0, 30000));
    await ctx.close();
  }

  // RES-07 · se pierde la respuesta de una escritura (el servidor sí guardó) y el usuario reintenta
  { const mock = crearMock(100); const { ctx, p } = await nuevaPagina(b, mock);
    await p.goto(BASE + '/juegos'); await listoJuegos(p); await crearJuego(p, 'Tiro');
    mock.estado.perderRespuesta = VERSION === 'antes' ? 'juegos' : 'guardar_juego'; let t0 = Date.now();
    await p.click('.btn-guardar');
    const r = await esperarMensaje(p, t0, 30000);
    let r2 = null;
    if (!r.exito) { await p.waitForTimeout(500); t0 = await guardarDeNuevo(p); r2 = await esperarMensaje(p, t0, 30000); }
    await p.reload(); await listoJuegos(p);
    fila('RES-07', 'Reintento de una escritura cuya respuesta se perdió', { primerIntento: r, reintentoDelUsuario: r2, copiasEnBase: mock.db.juegos.filter(j => j.nombre === 'Tiro').length, pestañasTrasRecargar: await p.locator('.tab-juego').count() });
    await ctx.close(); }

  // RES-08 · respuesta tardía (3 s) y el usuario pulsa Guardar 3 veces
  { const mock = crearMock(100); const { ctx, p } = await nuevaPagina(b, mock);
    await p.goto(BASE + '/juegos'); await listoJuegos(p); await crearJuego(p, 'Costales');
    mock.estado.retrasoExtra = 3000; const n0 = mock.log.length; const t0 = Date.now();
    for (let i = 0; i < 3; i++) await p.locator('.btn-guardar').click({ force: true, timeout: 2000 }).catch(() => {});
    const r = await esperarMensaje(p, t0, 120000);
    const escrituras = mock.log.slice(n0).filter(l => /^POST (juegos|guardar_juego) /.test(l)).length;
    fila('RES-08', 'Respuesta tardía (3 s) con 3 clics en Guardar', { ...r, solicitudesDeCreacion: escrituras, copiasEnBase: mock.db.juegos.filter(j => j.nombre === 'Costales').length });
    await ctx.close(); }

  require('fs').writeFileSync(`${__dirname}/resiliencia-${VERSION}.json`, JSON.stringify(R, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
