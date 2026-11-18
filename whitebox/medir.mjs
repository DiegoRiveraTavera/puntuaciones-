/**
 * PRÁCTICA 11 — Pruebas White Box · Fases 3 y 5
 * Mediciones REALES desde tu equipo contra Supabase (base de datos/API) y Vercel (sitio + función).
 *
 * Uso (PowerShell, en la carpeta del proyecto):
 *   $env:PRUEBA_CORREO="tu@correo.com"; $env:PRUEBA_PASSWORD="tuContraseña"; $env:CONEXION="WiFi casa"
 *   node whitebox/medir.mjs
 *
 * Genera whitebox/resultados/medicion-<fecha>.json y .txt
 * - No usa ni necesita la "secret key": solo la clave publicable (la misma de la app) y tu sesión.
 * - Todo lo que escribe en la base va a una sesión de prueba con fecha 2099-12-31 y se borra al final.
 * - El token de sesión nunca se imprime ni se guarda en los resultados.
 */
import https from 'node:https';
import http from 'node:http';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const SUPABASE = process.env.SUPABASE_URL || 'https://berxzmxipyapcczfwynl.supabase.co';
const KEY = process.env.SUPABASE_KEY || 'sb_publishable_jyXb_vegqKWGh_4BURo11A_0adNCWNf';
const SITIO = process.env.SITIO_URL || 'https://puntuaciones.vercel.app';
const CORREO = process.env.PRUEBA_CORREO, PASSWORD = process.env.PRUEBA_PASSWORD;
const FECHA_PRUEBA = '2099-12-31';
const BUCKET = 'fotos-tecnica';
if (!CORREO || !PASSWORD) {
  console.error('Faltan PRUEBA_CORREO y PRUEBA_PASSWORD (ver instrucciones al inicio del archivo).');
  process.exit(1);
}

// ───────────────────────── utilidades ─────────────────────────
const R = { entorno: {}, ping: {}, http: {}, endpoints: [], transferencia: {}, carga: {}, interrupcion: {}, notas: [] };
const log = (...a) => console.log(...a);
const prom = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const desv = a => { const m = prom(a); return Math.sqrt(prom(a.map(x => (x - m) ** 2))); };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const r2 = n => Math.round(n * 100) / 100;
const resumen = a => ({ n: a.length, min: r2(Math.min(...a)), max: r2(Math.max(...a)), prom: r2(prom(a)), desv: r2(desv(a)), p95: r2(pct(a, 95)) });
const mbps = (bytes, ms) => r2((bytes * 8) / (ms / 1000) / 1e6);

/**
 * Petición HTTP con tiempos por fase (DNS, TCP, TLS, primer byte, total).
 * keepAlive=false → conexión nueva en cada petición (mide el costo completo).
 */
function peticion(url, { method = 'GET', headers = {}, body = null, agente = null } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const t = { inicio: performance.now() };
    const req = lib.request(u, { method, headers, agent: agente ?? new lib.Agent({ keepAlive: false }) }, res => {
      t.primerByte = performance.now();
      const trozos = [];
      res.on('data', c => trozos.push(c));
      res.on('end', () => {
        t.fin = performance.now();
        const cuerpo = Buffer.concat(trozos);
        resolve({
          status: res.statusCode, bytes: cuerpo.length, cuerpo: cuerpo.toString('utf8'), headers: res.headers,
          ms: {
            dns: t.dns != null ? r2(t.dns - t.inicio) : 0,
            tcp: t.tcp != null ? r2(t.tcp - (t.dns ?? t.inicio)) : 0,
            tls: t.tls != null ? r2(t.tls - t.tcp) : 0,
            servidor: r2(t.primerByte - (t.tls ?? t.tcp ?? t.inicio)),   // espera hasta el primer byte
            descarga: r2(t.fin - t.primerByte),
            total: r2(t.fin - t.inicio),
          },
        });
      });
    });
    req.on('socket', s => {
      s.once('lookup', () => (t.dns = performance.now()));
      s.once('connect', () => (t.tcp = performance.now()));
      s.once('secureConnect', () => (t.tls = performance.now()));
    });
    req.on('error', e => resolve({ status: 0, bytes: 0, error: e.code || e.message, ms: { total: r2(performance.now() - t.inicio) } }));
    req.setTimeout(30000, () => req.destroy(new Error('TIMEOUT')));
    if (body) req.write(body);
    req.end();
  });
}

let TOKEN = null, USUARIO = null;
const H = (extra = {}) => ({ apikey: KEY, ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}), ...extra });
const JSONH = (extra = {}) => H({ 'Content-Type': 'application/json', ...extra });
/** Agente con conexión reutilizable (keep-alive) del protocolo correcto. */
const agenteKA = url => new (url.startsWith('http:') ? http : https).Agent({ keepAlive: true });
const rest = (ruta, opc = {}) => peticion(`${SUPABASE}/rest/v1/${ruta}`, opc);
/** Quita del texto cualquier token o contraseña antes de guardarlo. */
const limpio = s => String(s ?? '').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<token>').replaceAll(PASSWORD, '<contraseña>').slice(0, 300);

// ───────────────────────── 0. entorno ─────────────────────────
function entorno() {
  let commit = 'desconocido';
  try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
  let version = '';
  try { version = JSON.parse(readFileSync('package.json', 'utf8')).version; } catch {}
  R.entorno = {
    fecha: new Date().toISOString(), zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
    equipo: os.hostname(), so: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
    cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`, memoriaGB: r2(os.totalmem() / 2 ** 30),
    node: process.version, conexion: process.env.CONEXION || '(no indicada: usa $env:CONEXION)',
    commit, versionApp: version, servidorBD: SUPABASE.replace('https://', ''), sitio: SITIO.replace('https://', ''),
  };
  log('Entorno:', R.entorno);
}

// ───────────────────────── 1. ping (ICMP) ─────────────────────────
function ping(host) {
  const win = process.platform === 'win32';
  const r = spawnSync('ping', win ? ['-n', '20', host] : ['-c', '20', host], { encoding: 'latin1', timeout: 60000 });
  const salida = (r.stdout || '') + (r.stderr || '');
  const tiempos = [...salida.matchAll(/(?:tiempo|time)[=<]\s*([\d.,]+)\s*ms/gi)].map(m => parseFloat(m[1].replace(',', '.')));
  const enviados = 20;
  const perdida = r2(((enviados - tiempos.length) / enviados) * 100);
  const res = tiempos.length
    ? { host, enviados, recibidos: tiempos.length, perdidaPct: perdida, ...resumen(tiempos), muestras: tiempos }
    : { host, enviados, recibidos: 0, perdidaPct: 100, nota: 'Sin respuesta ICMP: el servidor o la red bloquean ping. Se usa la latencia HTTP como alternativa.', salida: salida.slice(-400) };
  log(`ping ${host}:`, res.recibidos ? `min ${res.min} / prom ${res.prom} / max ${res.max} ms, desv ${res.desv}, pérdida ${res.perdidaPct}%` : res.nota);
  return res;
}

// ───────────────────────── 2. sesión ─────────────────────────
async function iniciarSesion() {
  const r = await peticion(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CORREO, password: PASSWORD }),
  });
  if (r.status !== 200) throw new Error(`No se pudo iniciar sesión (HTTP ${r.status}): ${limpio(r.cuerpo)}`);
  const j = JSON.parse(r.cuerpo);
  TOKEN = j.access_token; USUARIO = j.user.id;
  // Se busca el VALOR de la contraseña (la palabra "password" aparece legítimamente en "amr":[{"method":"password"}])
  const traeContrasena = r.cuerpo.includes(PASSWORD);
  const campos = Object.keys(j).concat(Object.keys(j.user ?? {}).map(k => 'user.' + k));
  const sospechosos = campos.filter(k => /pass|secret|hash/i.test(k));
  R.endpoints.push({ id: 'AUTH-200', desc: 'Login correcto', esperado: 200, obtenido: r.status, ms: r.ms.total, bytes: r.bytes, ok: r.status === 200,
    campos,
    observacion: `Trae access_token y refresh_token (necesarios para la sesión). El valor de la contraseña ${traeContrasena ? 'SÍ' : 'NO'} aparece en la respuesta; ` +
      `campos con nombre sensible: ${sospechosos.length ? sospechosos.join(', ') : 'ninguno'}.` });
}

// ───────────────────────── 3. endpoints y códigos HTTP (Fase 3) ─────────────────────────
async function endpoints() {
  const casos = [];
  const caso = async (id, desc, esperado, fn, revisar) => {
    const r = await fn();
    let obs = '';
    try { obs = revisar ? revisar(r) : ''; } catch (e) { obs = 'no se pudo analizar: ' + e.message; }
    const fila = { id, desc, esperado, obtenido: r.status, ms: r.ms.total, bytes: r.bytes, cuerpo: limpio(r.cuerpo), observacion: obs, ok: [].concat(esperado).includes(r.status) };
    casos.push(fila);
    log(`${fila.ok ? 'OK   ' : 'DIF. '} ${id} ${desc}: esperado ${esperado}, obtenido ${r.status} (${r.ms.total} ms, ${r.bytes} B)`);
    return r;
  };
  const sinToken = { apikey: KEY };

  // Autenticación (401) vs autorización (403)
  await caso('WEB-401a', 'Leer calificaciones SIN sesión (solo clave publicable)', 401,
    () => rest('calificaciones_tecnica?select=id', { headers: sinToken }));
  await caso('WEB-401b', 'Token inválido/expirado', 401,
    () => rest('escuadras?select=id', { headers: { apikey: KEY, Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.firma-falsa' } }));
  await caso('AUTH-400', 'Login con contraseña incorrecta', 400,
    () => peticion(`${SUPABASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: CORREO, password: 'Incorrecta-' + Date.now() }) }),
    r => (JSON.parse(r.cuerpo).user ? 'devuelve usuario (mal)' : 'no revela si el correo existe: mensaje genérico'));
  await caso('WEB-403', 'Con sesión: crear un registro a nombre de OTRO usuario (RLS)', 403,
    () => rest('sesiones', { method: 'POST', headers: JSONH(), body: JSON.stringify({ fecha: '2099-12-30', creado_por: '00000000-0000-0000-0000-000000000000' }) }));

  // Lectura
  await caso('WEB-200', 'Consultar escuadras (lectura)', 200, () => rest('escuadras?select=id,nombre&activa=eq.true&order=id', { headers: H() }),
    r => { const j = JSON.parse(r.cuerpo); return `${j.length} escuadras; estructura ${JSON.stringify(Object.keys(j[0] ?? {}))}`; });
  await caso('WEB-200b', 'Consultar escuadra por id inexistente', 200, () => rest('escuadras?select=id,nombre&id=eq.987654', { headers: H() }),
    r => `PostgREST no usa 404 para un filtro sin resultados: devuelve ${r.cuerpo}`);
  await caso('WEB-406', 'Pedir UN solo registro inexistente (Accept objeto, como .single())', 406,
    () => rest('escuadras?select=id&id=eq.987654', { headers: H({ Accept: 'application/vnd.pgrst.object+json' }) }));
  await caso('WEB-404', 'Recurso (tabla) inexistente', 404, () => rest('tabla_que_no_existe?select=*', { headers: H() }));

  // Escritura sobre una sesión de prueba
  const s = await caso('WEB-201', 'Crear sesión de prueba (escritura)', [201, 409],
    () => rest('sesiones?select=id,fecha', { method: 'POST', headers: JSONH({ Prefer: 'return=representation' }), body: JSON.stringify({ fecha: FECHA_PRUEBA }) }));
  let sesionId = s.status === 201 ? JSON.parse(s.cuerpo)[0].id : null;
  if (!sesionId) sesionId = JSON.parse((await rest(`sesiones?select=id&fecha=eq.${FECHA_PRUEBA}`, { headers: H() })).cuerpo)[0]?.id;
  R.sesionPrueba = sesionId;
  await caso('WEB-409', 'Crear otra sesión con la MISMA fecha (UNIQUE)', 409,
    () => rest('sesiones', { method: 'POST', headers: JSONH(), body: JSON.stringify({ fecha: FECHA_PRUEBA }) }));
  await caso('WEB-400a', 'Juego con valor 0 (CHECK valor > 0)', 400,
    () => rest('juegos', { method: 'POST', headers: JSONH(), body: JSON.stringify({ sesion_id: sesionId, nombre: 'Prueba', valor: 0 }) }));
  await caso('WEB-400b', 'JSON mal formado', 400,
    () => rest('juegos', { method: 'POST', headers: JSONH(), body: '{"sesion_id": ' }));
  await caso('WEB-400c', 'Calificación incompleta (NOT NULL)', 400,
    () => rest('calificaciones_tecnica', { method: 'POST', headers: JSONH(), body: JSON.stringify({ sesion_id: sesionId, escuadra_id: 1, fuerza: 8 }) }));
  await caso('WEB-409b', 'Escuadra inexistente (llave foránea)', 409,
    () => rest('calificaciones_tecnica', { method: 'POST', headers: JSONH(), body: JSON.stringify({ sesion_id: sesionId, escuadra_id: 987654, fuerza: 8, utilidad: 8, firmeza: 8, estabilidad: 8, originalidad: 8 }) }));
  const j = await caso('WEB-201b', 'Crear juego válido', 201,
    () => rest('juegos?select=id,nombre,valor,creado_por', { method: 'POST', headers: JSONH({ Prefer: 'return=representation' }), body: JSON.stringify({ sesion_id: sesionId, nombre: 'Prueba WB', valor: 15 }) }),
    r => { const x = JSON.parse(r.cuerpo)[0]; return `creado_por = usuario de la sesión: ${x.creado_por === USUARIO}`; });
  const juegoId = JSON.parse(j.cuerpo)[0]?.id;
  await caso('WEB-200c', 'Actualizar juego', 200,
    () => rest(`juegos?id=eq.${juegoId}&select=id,valor`, { method: 'PATCH', headers: JSONH({ Prefer: 'return=representation' }), body: JSON.stringify({ valor: 20 }) }));
  await caso('WEB-204', 'Eliminar juego (sin cuerpo de respuesta)', 204,
    () => rest(`juegos?id=eq.${juegoId}`, { method: 'DELETE', headers: H() }));
  await caso('WEB-200d', 'Consultar juego eliminado → lista vacía (persistencia)', 200,
    () => rest(`juegos?select=id&id=eq.${juegoId}`, { headers: H() }), r => `cuerpo ${r.cuerpo}`);

  // Función serverless de Vercel
  const N = `${SITIO}/api/notificaciones/tecnica`;
  await caso('API-200', 'Notificación válida', 200, () => peticion(N, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ escuadra: 'PRUEBA', puntos: 1 }) }));
  await caso('API-400', 'Notificación sin escuadra', 400, () => peticion(N, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ puntos: 1 }) }));
  await caso('API-400b', 'Notificación con puntos como texto', 400, () => peticion(N, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ escuadra: 'X', puntos: '10' }) }));
  await caso('API-405', 'Método GET no permitido', 405, () => peticion(N));
  await caso('API-204', 'Preflight CORS (OPTIONS)', 204, () => peticion(N, { method: 'OPTIONS' }));
  await caso('API-401?', 'Notificación SIN ninguna credencial (¿debería pedir autenticación?)', 401,
    () => peticion(N, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ escuadra: 'SIN-SESION', puntos: 999 }) }));
  await caso('API-buscar', 'Buscador del menú: GET /api/buscar?q=ju', 200, () => peticion(`${SITIO}/api/buscar?q=ju`));
  await caso('SITIO-200', 'Página principal del sitio', 200, () => peticion(`${SITIO}/`));
  R.endpoints.push(...casos);
}

// ───────────────────────── 4. latencia HTTP: 10 solicitudes iguales (Fase 5 B y D) ─────────────────────────
async function latencia() {
  const url = `${SUPABASE}/rest/v1/escuadras?select=id,nombre&activa=eq.true&order=id`;
  const fria = [], caliente = [];
  for (let i = 0; i < 10; i++) fria.push(await rest(url.split('/rest/v1/')[1], { headers: H() }));
  const agente = agenteKA(url);
  for (let i = 0; i < 10; i++) caliente.push(await peticion(url, { headers: H(), agente }));
  agente.destroy();
  const tabla = r => r.map((x, i) => ({ n: i + 1, status: x.status, ms: x.ms.total, bytes: x.bytes, dns: x.ms.dns, tcp: x.ms.tcp, tls: x.ms.tls, servidor: x.ms.servidor }));
  R.http.endpoint = 'GET /rest/v1/escuadras?select=id,nombre&activa=eq.true&order=id';
  R.http.conexionNueva = { solicitudes: tabla(fria), total: resumen(fria.map(x => x.ms.total)),
    fases: { dns: r2(prom(fria.map(x => x.ms.dns))), tcp: r2(prom(fria.map(x => x.ms.tcp))), tls: r2(prom(fria.map(x => x.ms.tls))), servidor: r2(prom(fria.map(x => x.ms.servidor))) },
    exitosas: fria.filter(x => x.status === 200).length, bytesProm: r2(prom(fria.map(x => x.bytes))) };
  R.http.conexionReutilizada = { solicitudes: tabla(caliente), total: resumen(caliente.map(x => x.ms.total)), exitosas: caliente.filter(x => x.status === 200).length };
  log('Latencia HTTP (conexión nueva):', R.http.conexionNueva.total, 'fases prom:', R.http.conexionNueva.fases);
  log('Latencia HTTP (keep-alive):', R.http.conexionReutilizada.total);

  // Comparación: misma consulta pidiendo TODAS las columnas (select=*) → tamaño de respuesta
  const todo = []; for (let i = 0; i < 10; i++) todo.push(await rest('calificaciones_tecnica?select=*', { headers: H() }));
  const minimo = []; for (let i = 0; i < 10; i++) minimo.push(await rest('calificaciones_tecnica?select=id,escuadra_id,total', { headers: H() }));
  R.http.tamano = {
    selectTodo: { bytesProm: r2(prom(todo.map(x => x.bytes))), ms: resumen(todo.map(x => x.ms.total)) },
    selectNecesario: { bytesProm: r2(prom(minimo.map(x => x.bytes))), ms: resumen(minimo.map(x => x.ms.total)) },
  };
  // Vista de ranking (la consulta más pesada de la app)
  const rk = []; for (let i = 0; i < 10; i++) rk.push(await rest('ranking_general?select=escuadra,puntos_juegos,puntos_tecnica,puntos_formacion,total&order=fecha.desc&limit=12', { headers: H() }));
  R.http.ranking = { ms: resumen(rk.map(x => x.ms.total)), servidor: resumen(rk.map(x => x.ms.servidor)), bytesProm: r2(prom(rk.map(x => x.bytes))), exitosas: rk.filter(x => x.status === 200).length };
}

// ───────────────────────── 5. tasa de transferencia (subida / descarga) ─────────────────────────
async function transferencia() {
  const TAM = 2 * 1024 * 1024; // 2 MB
  const subida = [], bajada = [], bajadaSitio = [];
  for (let i = 1; i <= 3; i++) {
    const ruta = `${R.sesionPrueba ?? 'prueba'}/wb-transferencia-${Date.now()}-${i}.jpg`;
    const datos = randomBytes(TAM);
    const up = await peticion(`${SUPABASE}/storage/v1/object/${BUCKET}/${ruta}`, { method: 'POST', headers: H({ 'Content-Type': 'image/jpeg' }), body: datos });
    subida.push({ n: i, status: up.status, bytes: TAM, ms: up.ms.total, mbps: up.status === 200 ? mbps(TAM, up.ms.total) : 0, error: up.status === 200 ? undefined : limpio(up.cuerpo) });
    const down = await peticion(`${SUPABASE}/storage/v1/object/authenticated/${BUCKET}/${ruta}`, { headers: H() });
    bajada.push({ n: i, status: down.status, bytes: down.bytes, ms: down.ms.total, mbps: down.status === 200 ? mbps(down.bytes, down.ms.total) : 0 });
    await peticion(`${SUPABASE}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: JSONH(), body: JSON.stringify({ prefixes: [ruta] }) });
  }
  // Descarga del paquete principal de la app web
  const html = (await peticion(`${SITIO}/`)).cuerpo;
  const js = (html.match(/src="([^"]*main[^"]*\.js)"/) || [])[1];
  if (js) for (let i = 1; i <= 3; i++) {
    const d = await peticion(new URL(js, SITIO).href, { headers: { 'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache' } });
    bajadaSitio.push({ n: i, status: d.status, bytes: d.bytes, ms: d.ms.total, mbps: mbps(d.bytes, d.ms.total), cache: d.headers?.['x-vercel-cache'] });
  }
  R.transferencia = { archivoMB: 2, subidaStorage: subida, descargaStorage: bajada, descargaSitio: { archivo: js, mediciones: bajadaSitio },
    resumen: {
      subidaMbps: r2(prom(subida.filter(x => x.mbps).map(x => x.mbps))), descargaMbps: r2(prom(bajada.filter(x => x.mbps).map(x => x.mbps))),
      descargaSitioMbps: r2(prom(bajadaSitio.map(x => x.mbps))), tiempoDescargaS: r2(prom(bajada.map(x => x.ms)) / 1000),
    } };
  log('Transferencia:', R.transferencia.resumen);
}

// ───────────────────────── 6. carga controlada 1 / 5 / 10 usuarios ─────────────────────────
async function carga() {
  const escenario = async (nombre, usuarios, hacer) => {
    const total = Math.max(20, usuarios * 4);   // al menos 20 solicitudes por escenario
    const resultados = []; let siguiente = 0;
    const cpu0 = process.cpuUsage(), t0 = performance.now();
    await Promise.all(Array.from({ length: usuarios }, async () => {
      const agente = agenteKA(SUPABASE);
      while (siguiente < total) { const i = siguiente++; resultados.push(await hacer(i, agente)); }
      agente.destroy();
    }));
    const dur = performance.now() - t0, cpu = process.cpuUsage(cpu0);
    const ok = resultados.filter(r => r.status >= 200 && r.status < 300);
    const bytes = resultados.reduce((a, r) => a + r.bytes, 0);
    const fila = { escenario: nombre, usuarios, solicitudes: resultados.length, exitosas: ok.length, fallidas: resultados.length - ok.length,
      codigos: resultados.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {}),
      ...Object.fromEntries(Object.entries(resumen(resultados.map(r => r.ms.total))).map(([k, v]) => [k + 'Ms', v])),
      duracionS: r2(dur / 1000), solicitudesPorS: r2(resultados.length / (dur / 1000)), mbps: mbps(bytes, dur),
      cpuClienteMs: r2((cpu.user + cpu.system) / 1000), memoriaClienteMB: r2(process.memoryUsage().rss / 2 ** 20) };
    log(`Carga ${nombre} ×${usuarios}: prom ${fila.promMs} ms, P95 ${fila.p95Ms} ms, ok ${fila.exitosas}/${fila.solicitudes}`);
    return fila;
  };
  const leer = (i, agente) => peticion(`${SUPABASE}/rest/v1/ranking_general?select=escuadra,total&order=fecha.desc&limit=12`, { headers: H(), agente });
  const escribir = (i, agente) => peticion(`${SUPABASE}/rest/v1/juegos`, { method: 'POST', agente,
    headers: JSONH({ Prefer: 'return=minimal' }), body: JSON.stringify({ sesion_id: R.sesionPrueba, nombre: `carga-${i}`, valor: 1 }) });
  R.carga.lectura = []; R.carga.escritura = [];
  for (const u of [1, 5, 10]) R.carga.lectura.push(await escenario('lectura ranking_general', u, leer));
  for (const u of [1, 5, 10]) {
    R.carga.escritura.push(await escenario('escritura juegos', u, escribir));
    const c = await rest(`juegos?select=id&sesion_id=eq.${R.sesionPrueba}`, { headers: H({ Prefer: 'count=exact', Range: '0-0' }) });
    R.carga.escritura.at(-1).filasEnBase = Number((c.headers['content-range'] || '/0').split('/')[1]);
    await rest(`juegos?sesion_id=eq.${R.sesionPrueba}`, { method: 'DELETE', headers: H() });
  }
}

// ───────────────────────── 7. limpieza ─────────────────────────
async function limpiar() {
  if (!R.sesionPrueba) return;
  const r = await rest(`sesiones?fecha=eq.${FECHA_PRUEBA}`, { method: 'DELETE', headers: H() });
  R.notas.push(`Limpieza: sesión de prueba ${FECHA_PRUEBA} borrada (HTTP ${r.status}); sus juegos se borran en cascada.`);
  await peticion(`${SUPABASE}/auth/v1/logout`, { method: 'POST', headers: H() });
}

// ───────────────────────── main ─────────────────────────
const SOLO = process.argv[2];   // opcional: "ping", "endpoints", "latencia", "transferencia", "carga"
try {
  entorno();
  if (!SOLO || SOLO === 'ping') {
    R.ping.supabase = ping(new URL(SUPABASE).hostname);
    R.ping.vercel = ping(new URL(SITIO).hostname);
  }
  await iniciarSesion();
  if (!SOLO || SOLO === 'endpoints') await endpoints();
  if (!SOLO || SOLO === 'latencia') await latencia();
  if (!SOLO || SOLO === 'transferencia') await transferencia();
  if (!SOLO || SOLO === 'carga') await carga();
} catch (e) {
  R.notas.push('ERROR: ' + limpio(e.message));
  console.error(e);
} finally {
  await limpiar().catch(() => {});
  mkdirSync(new URL('./resultados/', import.meta.url), { recursive: true });
  const nombre = `medicion-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  const texto = JSON.stringify(R, null, 1);
  if (texto.includes(PASSWORD) || (TOKEN && texto.includes(TOKEN))) throw new Error('El resultado contiene un secreto; no se guardó.');
  writeFileSync(new URL(`./resultados/${nombre}.json`, import.meta.url), texto);
  log(`\nResultados guardados en whitebox/resultados/${nombre}.json — mándame ese archivo.`);
}
