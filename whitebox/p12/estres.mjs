/**
 * PRÁCTICA 12 — Pruebas de estrés, concurrencia y operación crítica contra Supabase REAL.
 *
 * Uso (CMD, en la carpeta del proyecto):
 *   set PRUEBA_CORREO=tu-correo
 *   set PRUEBA_PASSWORD=tu-contraseña
 *   set CONEXION=WiFi casa
 *   node whitebox/p12/estres.mjs antes      ← ANTES de correr supabase/03_optimizacion_p12.sql
 *   node whitebox/p12/estres.mjs despues    ← DESPUÉS de correr la migración
 *
 * "antes" guarda cada juego con la misma secuencia de peticiones que la versión anterior de
 * JuegosRepositorio.guardar (≈14 peticiones por juego); "despues" usa la llamada única
 * rpc/guardar_juego. Todo se escribe en una sesión de prueba (2099-12-31) que se borra al final.
 * El token y la contraseña nunca se guardan en el resultado.
 */
import https from 'node:https';
import http from 'node:http';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const MODO = process.argv[2];
if (!['antes', 'despues'].includes(MODO)) { console.error('Indica el modo: antes | despues'); process.exit(1); }
const SUPABASE = process.env.SUPABASE_URL || 'https://berxzmxipyapcczfwynl.supabase.co';
const KEY = process.env.SUPABASE_KEY || 'sb_publishable_jyXb_vegqKWGh_4BURo11A_0adNCWNf';
const CORREO = process.env.PRUEBA_CORREO, PASSWORD = process.env.PRUEBA_PASSWORD;
const FECHA = '2099-12-31';
if (!CORREO || !PASSWORD) { console.error('Faltan PRUEBA_CORREO y PRUEBA_PASSWORD.'); process.exit(1); }

const R = { modo: MODO, entorno: {}, operacionCritica: {}, lectura: [], escritura: [], concurrenciaBD: {}, integridad: {}, notas: [] };
const log = (...a) => console.log(...a);
const prom = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]; };
const r1 = n => Math.round(n * 10) / 10;
const est = a => a.length ? { prom: r1(prom(a)), p90: r1(pct(a, 90)), p95: r1(pct(a, 95)), max: r1(Math.max(...a)), min: r1(Math.min(...a)) } : {};

// ── HTTP con conexión reutilizable (como el navegador)
const LIB = SUPABASE.startsWith('http:') ? http : https;   // http solo para probar el script en local
const agente = new LIB.Agent({ keepAlive: true, maxSockets: 64 });
let peticionesHTTP = 0;
function peticion(url, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise(resolve => {
    peticionesHTTP++;
    const t0 = performance.now();
    const req = LIB.request(new URL(url), { method, headers, agent: agente }, res => {
      const trozos = []; res.on('data', c => trozos.push(c));
      res.on('end', () => resolve({ status: res.statusCode, ms: performance.now() - t0, bytes: Buffer.concat(trozos).length, cuerpo: Buffer.concat(trozos).toString('utf8'), headers: res.headers }));
    });
    req.on('error', e => resolve({ status: 0, ms: performance.now() - t0, bytes: 0, cuerpo: e.code || e.message }));
    req.setTimeout(30000, () => req.destroy(new Error('TIMEOUT')));
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}
let TOKEN = null;
const H = (extra = {}) => ({ apikey: KEY, Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...extra });
const rest = (ruta, opc = {}) => peticion(`${SUPABASE}/rest/v1/${ruta}`, { ...opc, headers: H(opc.headers) });
const ok = r => r.status >= 200 && r.status < 300;
const json = r => { try { return JSON.parse(r.cuerpo); } catch { return null; } };

// ── Juego de prueba: 2 roles × 2 enfrentamientos, con ganador (igual que en el profiling)
let ESC = [];   // 4 escuadras reales de la base
const juegoPrueba = (nombre, idCliente = randomUUID()) => ({
  idCliente, nombre, valor: 10,
  roles: [1, 2].map(n => ({ numero: n, enfrentamientos: [[ESC[0], ESC[1]], [ESC[2], ESC[3]]].map(([a, b]) => ({ escuadras: [a.nombre, b.nombre], ganador: a.nombre })) })),
});

/**
 * ANTES: la misma secuencia de peticiones que hacía JuegosRepositorio.guardar (versión P11):
 * obtenerSesion · listarEscuadras · insertar juego · borrar enfrentamientos ·
 * por enfrentamiento: insertar · registrar escuadras en la sesión · participantes · ganador.
 */
async function guardarAntes(juego) {
  const codigos = []; const chk = r => { codigos.push(r.status); if (!ok(r)) throw Object.assign(new Error(`HTTP ${r.status}`), { codigos }); return r; };
  const s = json(chk(await rest(`sesiones?select=id&fecha=eq.${FECHA}`)));
  const sesionId = s?.[0]?.id;
  const escuadras = json(chk(await rest('escuadras?select=id,nombre&activa=eq.true&order=id')));
  const porNombre = new Map(escuadras.map(e => [e.nombre.toUpperCase(), e.id]));
  const nuevo = json(chk(await rest('juegos?select=id', { method: 'POST', headers: { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' }, body: { sesion_id: sesionId, nombre: juego.nombre, valor: juego.valor } })));
  chk(await rest(`enfrentamientos?juego_id=eq.${nuevo.id}`, { method: 'DELETE' }));
  const enSesion = new Set();
  for (const rol of juego.roles) for (const enf of rol.enfrentamientos) {
    const e = json(chk(await rest('enfrentamientos?select=id', { method: 'POST', headers: { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' }, body: { juego_id: nuevo.id, rol: rol.numero } })));
    const ids = enf.escuadras.map(n => porNombre.get(n.toUpperCase()));
    for (const id of ids) if (!enSesion.has(id)) {
      chk(await rest('sesion_escuadras?on_conflict=sesion_id,escuadra_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: { sesion_id: sesionId, escuadra_id: id } }));
      enSesion.add(id);
    }
    chk(await rest('enfrentamiento_escuadras', { method: 'POST', body: ids.map(escuadra_id => ({ enfrentamiento_id: e.id, escuadra_id })) }));
    chk(await rest(`enfrentamientos?id=eq.${e.id}`, { method: 'PATCH', body: { ganador_id: porNombre.get(enf.ganador.toUpperCase()) } }));
  }
  return { id: nuevo.id, codigos };
}
/** DESPUÉS: una sola llamada transaccional e idempotente. */
async function guardarDespues(juego) {
  const r = await rest('rpc/guardar_juego', { method: 'POST', body: { p_fecha: FECHA, p_juego: juego } });
  if (!ok(r)) throw Object.assign(new Error(`HTTP ${r.status}: ${r.cuerpo.slice(0, 120)}`), { codigos: [r.status] });
  return { id: json(r), codigos: [r.status] };
}
const guardar = MODO === 'antes' ? guardarAntes : guardarDespues;

async function contarDatos() {
  const juegos = json(await rest(`juegos?select=id,enfrentamientos(id,ganador_id,enfrentamiento_escuadras(escuadra_id))&sesion_id=eq.${SESION}`)) ?? [];
  const enf = juegos.flatMap(j => j.enfrentamientos);
  return { juegos: juegos.length, enfrentamientos: enf.length, participaciones: enf.reduce((a, e) => a + e.enfrentamiento_escuadras.length, 0), conGanador: enf.filter(e => e.ganador_id).length };
}
const borrarJuegos = () => rest(`juegos?sesion_id=eq.${SESION}`, { method: 'DELETE' });
let SESION = null;

// ── Escenario de carga: "usuarios" trabajadores en paralelo hasta completar "total" operaciones
async function escenario(usuarios, total, operacion) {
  const tiempos = [], codigos = {}; let fallidas = 0, siguiente = 0;
  const p0 = peticionesHTTP, cpu0 = process.cpuUsage(), t0 = performance.now();
  await Promise.all(Array.from({ length: usuarios }, async () => {
    while (siguiente < total) {
      const i = siguiente++; const t = performance.now();
      try { const r = await operacion(i); tiempos.push(performance.now() - t); r.codigos.forEach(c => codigos[c] = (codigos[c] || 0) + 1); }
      catch (e) { fallidas++; (e.codigos ?? [0]).forEach(c => codigos[c] = (codigos[c] || 0) + 1); }
    }
  }));
  const dur = (performance.now() - t0) / 1000, cpu = process.cpuUsage(cpu0);
  const http = peticionesHTTP - p0, errores = Object.entries(codigos).filter(([c]) => !(c >= 200 && c < 300)).reduce((a, [, n]) => a + n, 0);
  return { usuarios, operaciones: total, exitosas: total - fallidas, fallidas, pctErrores: r1(100 * errores / Math.max(1, http)), peticionesHTTP: http,
    opsPorS: r1(total / dur), rps: r1(http / dur), ...Object.fromEntries(Object.entries(est(tiempos)).map(([k, v]) => [k + 'Ms', v])),
    codigos, duracionS: r1(dur), cpuClienteMs: r1((cpu.user + cpu.system) / 1000), memoriaClienteMB: r1(process.memoryUsage().rss / 2 ** 20) };
}

try {
  // ── entorno
  let commit = '?'; try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
  R.entorno = { fecha: new Date().toISOString(), equipo: os.hostname(), so: `${os.type()} ${os.release()}`, cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
    node: process.version, conexion: process.env.CONEXION || '(no indicada)', commit, servidor: SUPABASE.replace('https://', '') };
  log('Entorno:', R.entorno);

  // ── sesión de usuario
  const login = await peticion(`${SUPABASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: { email: CORREO, password: PASSWORD } });
  if (login.status !== 200) throw new Error(`No se pudo iniciar sesión (HTTP ${login.status})`);
  TOKEN = json(login).access_token;
  ESC = (json(await rest('escuadras?select=id,nombre&activa=eq.true&order=id')) ?? []).slice(0, 4);
  if (ESC.length < 4) throw new Error('Se necesitan al menos 4 escuadras activas en la base.');
  const ses = json(await rest('sesiones?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { fecha: FECHA } }));
  SESION = ses?.[0]?.id ?? json(await rest(`sesiones?select=id&fecha=eq.${FECHA}`))[0].id;
  if (MODO === 'despues') {
    const prueba = await rest('rpc/guardar_juego', { method: 'POST', body: { p_fecha: FECHA, p_juego: juegoPrueba('verificacion') } });
    if (!ok(prueba)) throw new Error('La función guardar_juego no existe o falló: ¿ya corriste supabase/03_optimizacion_p12.sql? ' + prueba.cuerpo.slice(0, 150));
    await borrarJuegos();
  }

  // ── 1. Operación crítica: guardar 1 juego, 10 veces seguidas (sin concurrencia)
  { const t = [], pet = [];
    for (let i = 0; i < 10; i++) { const p0 = peticionesHTTP, t0 = performance.now(); await guardar(juegoPrueba(`critica-${i}`)); t.push(performance.now() - t0); pet.push(peticionesHTTP - p0); }
    R.operacionCritica = { descripcion: 'guardar 1 juego (2 roles × 2 enfrentamientos, con ganador)', ms: t.map(r1), ...est(t), peticionesPorOperacion: pet[0] };
    R.integridad.operacionCritica = { esperado: { juegos: 10, enfrentamientos: 40, participaciones: 80, conGanador: 40 }, obtenido: await contarDatos() };
    await borrarJuegos();
    log('Operación crítica:', R.operacionCritica.prom, 'ms promedio,', R.operacionCritica.peticionesPorOperacion, 'peticiones'); }

  // ── 2. Estrés de lectura (ranking_general, la consulta de Lugares) con 1, 5, 10, 20 y 50 usuarios
  for (const u of [1, 5, 10, 20, 50]) {
    const fila = await escenario(u, Math.max(40, u * 4), async () => {
      const r = await rest('ranking_general?select=escuadra,puntos_juegos,puntos_tecnica,puntos_formacion,total&order=fecha.desc&limit=12');
      if (!ok(r)) throw Object.assign(new Error(), { codigos: [r.status] });
      return { codigos: [r.status] };
    });
    R.lectura.push(fila); log(`Lectura ×${u}:`, fila.promMs, 'ms prom,', fila.p95Ms, 'P95,', fila.rps, 'RPS,', fila.pctErrores, '% errores');
  }

  // ── 3. Estrés de escritura (guardar juego completo) con 1, 5, 10 y 20 usuarios
  for (const u of [1, 5, 10, 20]) {
    const total = Math.max(20, u * 2);
    const fila = await escenario(u, total, i => guardar(juegoPrueba(`carga-${u}-${i}`)));
    fila.integridad = { esperado: { juegos: fila.exitosas, enfrentamientos: fila.exitosas * 4, participaciones: fila.exitosas * 8, conGanador: fila.exitosas * 4 }, obtenido: await contarDatos() };
    R.escritura.push(fila); log(`Escritura ×${u}:`, fila.promMs, 'ms prom,', fila.p95Ms, 'P95,', fila.opsPorS, 'juegos/s,', fila.rps, 'RPS,', fila.pctErrores, '% errores');
    await borrarJuegos();
  }

  // ── 4. Concurrencia sobre el MISMO registro
  // 4a. 10 dispositivos guardan a la vez el MISMO juego nuevo (como un reintento o un doble envío)
  { const mismo = juegoPrueba('mismo-juego');
    const rs = await Promise.allSettled(Array.from({ length: 10 }, () => guardar({ ...mismo })));
    const datos = await contarDatos();
    R.concurrenciaBD.mismoJuego = { solicitudes: 10, exitosas: rs.filter(r => r.status === 'fulfilled').length, copiasEnBase: datos.juegos, enfrentamientos: datos.enfrentamientos,
      esperado: 'una sola copia con 4 enfrentamientos' };
    log('Mismo juego ×10:', R.concurrenciaBD.mismoJuego);
    await borrarJuegos(); }
  // 4b. 10 actualizaciones simultáneas de UNA calificación con control de versión (como Técnica)
  { await rest(`calificaciones_tecnica?sesion_id=eq.${SESION}`, { method: 'DELETE' });
    const c = json(await rest('calificaciones_tecnica?select=id,version', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { sesion_id: SESION, escuadra_id: ESC[0].id, fuerza: 5, utilidad: 5, firmeza: 5, estabilidad: 5, originalidad: 5 } }))?.[0];
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => rest(`calificaciones_tecnica?id=eq.${c.id}&version=eq.${c.version}&select=id`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { fuerza: 1 + (i % 10) } })));
    const ganadores = rs.filter(r => ok(r) && (json(r) ?? []).length === 1).length;
    const final = json(await rest(`calificaciones_tecnica?select=version,fuerza&id=eq.${c.id}`))[0];
    // 4c. 10 actualizaciones simultáneas SIN control de versión: ¿se pierde alguna?
    const rs2 = await Promise.all(Array.from({ length: 10 }, (_, i) => rest(`calificaciones_tecnica?id=eq.${c.id}`, { method: 'PATCH', body: { utilidad: 1 + (i % 10) } })));
    const final2 = json(await rest(`calificaciones_tecnica?select=version,utilidad&id=eq.${c.id}`))[0];
    R.concurrenciaBD.calificacion = {
      conVersion: { solicitudes: 10, aplicadas: ganadores, rechazadasPorConflicto: 10 - ganadores, versionFinal: final.version, esperado: '1 aplicada, 9 conflictos, versión 2' },
      sinVersion: { solicitudes: 10, respuestasOK: rs2.filter(ok).length, versionFinal: final2.version, esperado: 'versión = 2 + 10 (cada escritura se serializa, ninguna se pierde)' },
    };
    log('Calificación concurrente:', R.concurrenciaBD.calificacion);
    await rest(`calificaciones_tecnica?id=eq.${c.id}`, { method: 'DELETE' }); }
} catch (e) {
  R.notas.push('ERROR: ' + String(e.message).replaceAll(PASSWORD, '<contraseña>'));
  console.error(e.message);
} finally {
  if (SESION) { const r = await rest(`sesiones?id=eq.${SESION}`, { method: 'DELETE' }); R.notas.push(`Limpieza: sesión de prueba ${FECHA} borrada (HTTP ${r.status}).`); }
  agente.destroy();
  mkdirSync(new URL('../resultados/', import.meta.url), { recursive: true });
  const texto = JSON.stringify(R, null, 1);
  if (texto.includes(PASSWORD) || (TOKEN && texto.includes(TOKEN))) throw new Error('El resultado contiene un secreto; no se guardó.');
  const archivo = `p12-${MODO}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  writeFileSync(new URL(`../resultados/${archivo}`, import.meta.url), texto);
  log(`\nResultados en whitebox/resultados/${archivo} — mándame ese archivo.`);
}
