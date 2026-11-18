/**
 * PRÁCTICA 11 — White Box de la base de datos (Fase 4)
 * Ejecuta el esquema real (supabase/01_esquema_puntuaciones.sql) en PostgreSQL 16 embebido (PGlite 0.2.17),
 * simulando lo que Supabase ya trae (roles anon/authenticated, auth.uid(), storage).
 * Recorre inserción válida/inválida, consultas, actualización, eliminación, persistencia,
 * concurrencia, transacciones, RLS y mide consultas con EXPLAIN ANALYZE.
 *
 * Uso:  cd whitebox/bd  &&  npm install  &&  node wb_bd.mjs
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync } from 'node:fs';

const db = new PGlite();
const stub = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id serial primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
grant usage, select on all sequences in schema storage to authenticated;
`;
await db.exec(stub);
const ESQUEMA = process.argv[2] ?? new URL('../../supabase/01_esquema_puntuaciones.sql', import.meta.url);
const DATOS = process.argv[3] ?? new URL('../../supabase/02_datos_iniciales.sql', import.meta.url);
await db.exec(readFileSync(ESQUEMA, 'utf8'));
console.log('Esquema cargado sin errores\n');

const JEFA = '11111111-1111-1111-1111-111111111111';
const OTRO = '22222222-2222-2222-2222-222222222222';   // cuenta que no es jefatura (suspendida)

const como = async (rol, uid, sql) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${rol};`);
  try { const r = await db.query(sql); return { ok: true, rows: r.rows, n: r.affectedRows }; }
  catch (e) { return { ok: false, err: e.message }; }
  finally { await db.exec('reset role;'); }
};
let fallas = 0;
const caso = (id, desc, cond, det) => { console.log(`${cond ? 'OK   ' : 'FALLA'} ${id} ${desc}${det ? '  → ' + det : ''}`); if (!cond) fallas++; };

// Cuentas creadas "desde el panel": el trigger crea su perfil
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${JEFA}', 'diego@moriah.com', '{"nombre":"Diego"}'), ('${OTRO}', 'otro@moriah.com', '{}');
  update public.perfiles set activo = false where id = '${OTRO}';`);
const perf = await db.query(`select nombre, rol, activo from public.perfiles order by nombre`);
caso('P-01', 'el trigger crea un perfil por cuenta', perf.rows.length === 2, JSON.stringify(perf.rows));

// Datos iniciales (script 02) como administrador
await db.exec(readFileSync(DATOS, 'utf8'));   // 6 escuadras iniciales

// ═════════════ PRÁCTICA 11 · White Box de la base de datos ═════════════
const J = (sql) => como('authenticated', JEFA, sql);
const t0 = () => performance.now();
console.log('\n── OP-1 calificaciones_tecnica (lo que hace TecnicaRepositorio.guardar)');
let r = await J(`insert into public.sesiones (fecha) values ('2026-11-10') returning id`);
const SES = r.rows[0].id;
await J(`insert into public.sesion_escuadras values (${SES},1),(${SES},2),(${SES},3)`);
r = await J(`insert into public.calificaciones_tecnica (sesion_id, escuadra_id, fuerza, utilidad, firmeza, estabilidad, originalidad)
  values (${SES}, 1, 8, 7, 9, 6, 10) returning id, total, version, creado_por`);
caso('DB-01a', 'inserción válida: total generado = 40, versión 1, autor = jefatura', r.ok && r.rows[0].total === 40 && r.rows[0].version === 1 && r.rows[0].creado_por === JEFA, JSON.stringify(r.rows?.[0] ?? r.err));
const CAL = r.rows?.[0]?.id;
r = await J(`insert into public.calificaciones_tecnica (sesion_id, escuadra_id, fuerza) values (${SES}, 2, 8)`);
caso('DB-02a', 'inserción incompleta (faltan criterios) → NOT NULL', !r.ok && /null/i.test(r.err), r.err);
r = await J(`insert into public.calificaciones_tecnica (sesion_id, escuadra_id, fuerza, utilidad, firmeza, estabilidad, originalidad) values (${SES}, 2, 0, 7, 9, 6, 10)`);
caso('DB-02b', 'valor límite 0 (fuera de 1–10) → CHECK', !r.ok && /check/i.test(r.err), r.err);
r = await J(`insert into public.calificaciones_tecnica (sesion_id, escuadra_id, fuerza, utilidad, firmeza, estabilidad, originalidad) values (${SES}, 2, 1, 1, 1, 1, 10) returning total`);
caso('DB-02c', 'valores límite 1 y 10 se aceptan (total 14)', r.ok && r.rows[0].total === 14, JSON.stringify(r.rows?.[0] ?? r.err));
r = await J(`insert into public.calificaciones_tecnica (sesion_id, escuadra_id, fuerza, utilidad, firmeza, estabilidad, originalidad) values (${SES}, 1, 5, 5, 5, 5, 5)`);
caso('DB-02d', 'segunda calificación para la misma escuadra y día → UNIQUE (23505)', !r.ok && /unique|duplicate/i.test(r.err), r.err);
r = await J(`insert into public.calificaciones_tecnica (sesion_id, escuadra_id, fuerza, utilidad, firmeza, estabilidad, originalidad) values (${SES}, 999, 5, 5, 5, 5, 5)`);
caso('DB-02e', 'escuadra inexistente → llave foránea (23503)', !r.ok && /foreign key/i.test(r.err), r.err);
r = await J(`update public.calificaciones_tecnica set total = 50 where id = ${CAL}`);
caso('DB-02f', 'no se puede escribir el total a mano (columna generada)', !r.ok, r.err);
r = await J(`select id, total from public.calificaciones_tecnica where id = ${CAL}`);
caso('DB-03a', 'consulta por id existente → 1 fila', r.ok && r.rows.length === 1, JSON.stringify(r.rows));
r = await J(`select id from public.calificaciones_tecnica where id = 987654`);
caso('DB-03b', 'consulta por id inexistente → 0 filas, sin error', r.ok && r.rows.length === 0);
r = await J(`update public.calificaciones_tecnica set fuerza = 10 where id = ${CAL} and version = 1 returning total, version, actualizado_por`);
caso('DB-04a', 'actualización: total 42, versión 2, registra quién', r.ok && r.rows[0].total === 42 && r.rows[0].version === 2 && r.rows[0].actualizado_por === JEFA, JSON.stringify(r.rows?.[0] ?? r.err));
r = await J(`update public.calificaciones_tecnica set fuerza = 10 where id = ${CAL} and version = 1 returning total, version, actualizado_por`);
caso('DB-06a', 'CONCURRENCIA: el 2.º celular guarda con versión vieja (1) → 0 filas, no pisa el cambio', r.ok && r.n === 0, `filas afectadas: ${r.n}`);
r = await J(`select total, version from public.calificaciones_tecnica where id = ${CAL}`);
caso('DB-07a', 'consulta posterior: persiste el cambio del 1.er celular (total 42, v2)', r.rows[0].total === 42 && r.rows[0].version === 2, JSON.stringify(r.rows[0]));
r = await J(`delete from public.calificaciones_tecnica where id = ${CAL} returning id`);
caso('DB-05a', 'eliminación → 1 fila', r.ok && r.rows.length === 1);
r = await J(`select count(*)::int n from public.calificaciones_tecnica where id = ${CAL}`);
caso('DB-07b', 'consulta posterior: ya no existe', r.rows[0].n === 0);

console.log('\n── OP-2 juegos / enfrentamientos (lo que hace JuegosRepositorio.guardar)');
r = await J(`insert into public.juegos (sesion_id, nombre, valor) values (${SES}, 'Relevos', 20) returning id, creado_por`);
caso('DB-01b', 'inserción válida de juego', r.ok, JSON.stringify(r.rows?.[0] ?? r.err));
const JUE = r.rows[0].id;
r = await J(`insert into public.juegos (sesion_id, nombre, valor) values (${SES}, '   ', 10)`);
caso('DB-02g', 'nombre vacío (solo espacios) → CHECK', !r.ok, r.err);
r = await J(`insert into public.juegos (sesion_id, nombre, valor) values (${SES}, 'Carrera', -5)`);
caso('DB-02h', 'valor negativo → CHECK', !r.ok, r.err);
r = await J(`insert into public.enfrentamientos (juego_id, rol) values (${JUE}, 1) returning id`);
const ENF = r.rows[0].id;
r = await J(`update public.enfrentamientos set ganador_id = 1 where id = ${ENF}`);
caso('DB-02i', 'ganador antes de registrar participantes → lo rechaza el trigger validar_ganador', !r.ok, r.err);
await J(`insert into public.enfrentamiento_escuadras values (${ENF},1),(${ENF},2)`);
r = await J(`update public.enfrentamientos set ganador_id = 2 where id = ${ENF} returning ganador_id`);
caso('DB-04b', 'ganador válido (participa) se registra', r.ok && r.rows[0].ganador_id === 2, r.err);
r = await J(`select escuadra, puntos_juegos from public.ranking_general where sesion_id = ${SES} and escuadra_id = 2`);
caso('DB-07c', 'la vista de ranking refleja los 20 pts de juegos', r.rows[0]?.puntos_juegos == 20, JSON.stringify(r.rows));
// Operación parcialmente completada: así guarda hoy la app (varias peticiones sin transacción)
await J(`delete from public.enfrentamientos where juego_id = ${JUE}`);          // paso 1 de guardar()
// ← aquí se "corta el internet": los pasos 2-4 (volver a insertar) nunca llegan
r = await J(`select escuadra, puntos_juegos from public.ranking_general where sesion_id = ${SES} and escuadra_id = 2`);
caso('DB-08', 'DEFECTO (operación parcial): si se corta la red tras el paso 1, ANK pierde sus 20 pts', r.rows[0]?.puntos_juegos == 20, `puntos_juegos de ANK quedó en ${r.rows[0]?.puntos_juegos}`);
// Lo mismo dentro de una transacción: el fallo deshace todo
await J(`insert into public.enfrentamientos (juego_id, rol) values (${JUE}, 1)`);
const ENF2 = (await J(`select id from public.enfrentamientos where juego_id = ${JUE}`)).rows[0].id;
await J(`insert into public.enfrentamiento_escuadras values (${ENF2},1),(${ENF2},2)`);
await J(`update public.enfrentamientos set ganador_id = 2 where id = ${ENF2}`);
r = await J(`select puntos_juegos from public.ranking_general where sesion_id = ${SES} and escuadra_id = 2`);
console.log(`      (antes de la transacción ANK tiene ${r.rows[0]?.puntos_juegos} pts)`);
await db.exec(`select set_config('request.jwt.claim.sub', '${JEFA}', false); set role authenticated;`);
try {
  await db.transaction(async tx => {
    await tx.query(`delete from public.enfrentamientos where juego_id = ${JUE}`);
    throw new Error('se cortó la conexión');
  });
} catch { /* rollback */ }
await db.exec('reset role;');
r = await J(`select puntos_juegos from public.ranking_general where sesion_id = ${SES} and escuadra_id = 2`);
caso('DB-09', 'con transacción, el corte deshace el borrado (ANK conserva 20 pts)', r.rows[0]?.puntos_juegos == 20, `puntos_juegos = ${r.rows[0]?.puntos_juegos}`);
r = await J(`delete from public.juegos where id = ${JUE}`);
r = await J(`select (select count(*) from public.enfrentamientos where juego_id = ${JUE})::int enf, (select count(*) from public.enfrentamiento_escuadras where enfrentamiento_id = ${ENF2})::int part`);
caso('DB-05b', 'eliminar un juego borra en cascada enfrentamientos y participantes', r.rows[0].enf === 0 && r.rows[0].part === 0, JSON.stringify(r.rows[0]));

console.log('\n── OP-3 formacion (lo que hace FormacionRepositorio.guardar: upsert)');
const UPSERT = (puntos, cuotas) => `insert into public.formacion (sesion_id, escuadra_id, cuotas, puntos) values (${SES}, 3, ${cuotas}, ${puntos})
  on conflict (sesion_id, escuadra_id) do update set cuotas = excluded.cuotas, puntos = excluded.puntos returning id, puntos, version`;
r = await J(UPSERT(10, 0));
caso('DB-01c', 'upsert inserta la formación de ATL', r.ok && r.rows[0].version === 1, JSON.stringify(r.rows?.[0] ?? r.err));
r = await J(UPSERT(10, -1));
caso('DB-02j', 'cuotas negativas → CHECK', !r.ok, r.err);
// Concurrencia: dos celulares cargaron la versión 1 y guardan distinto
await J(UPSERT(40, 0));   // celular A
r = await J(UPSERT(25, 0)); // celular B, sin saber del cambio de A
caso('DB-06b', 'DEFECTO (concurrencia): en Formación el 2.º guardado pisa al 1.º sin aviso', false, `quedó puntos=${r.rows[0].puntos}, versión=${r.rows[0].version}; el cambio de A (40) se perdió`);
r = await J(`update public.formacion set puntos = 9999 where sesion_id = ${SES} and escuadra_id = 3 returning puntos`);
caso('DB-10', 'RIESGO: la base acepta cualquier valor en formacion.puntos (lo calcula el cliente)', false, `se guardó puntos=${r.rows?.[0]?.puntos}`);

console.log('\n── Seguridad (RLS)');
r = await como('anon', null, `select * from public.calificaciones_tecnica`);
caso('SEG-a', 'sin sesión: 0 filas (RLS)', r.ok ? r.rows.length === 0 : true, r.ok ? `${r.rows.length} filas` : r.err);
r = await como('authenticated', OTRO, `delete from public.formacion`);
caso('SEG-b', 'cuenta no-jefatura: el DELETE no borra nada', r.ok ? r.n === 0 : true, r.ok ? `filas afectadas ${r.n}` : r.err);
r = await J(`select * from public.escuadras where nombre = '' or 1=1 --'`);
caso('SEG-c', 'inyección SQL: la app no arma SQL con texto; el cliente envía filtros como parámetros', true, 'ver análisis estático');

// ═════════════ Medición de consultas y planes de ejecución ═════════════
console.log('\n── Volumen de prueba: 120 sesiones × 6 escuadras con técnica, formación y 3 juegos');
await db.exec(`
  insert into public.sesiones (fecha) select date '2025-01-01' + g from generate_series(1,120) g on conflict do nothing;
  insert into public.sesion_escuadras select s.id, e.id from public.sesiones s cross join public.escuadras e on conflict do nothing;
  insert into public.calificaciones_tecnica (sesion_id, escuadra_id, fuerza, utilidad, firmeza, estabilidad, originalidad, creado_por)
    select se.sesion_id, se.escuadra_id, 1+(random()*9)::int, 1+(random()*9)::int, 1+(random()*9)::int, 1+(random()*9)::int, 1+(random()*9)::int, '${JEFA}'
    from public.sesion_escuadras se on conflict do nothing;
  insert into public.formacion (sesion_id, escuadra_id, puntos, creado_por) select sesion_id, escuadra_id, (random()*200)::int, '${JEFA}' from public.sesion_escuadras on conflict do nothing;
  insert into public.juegos (sesion_id, nombre, valor, creado_por) select s.id, 'J'||g, 10*g, '${JEFA}' from public.sesiones s, generate_series(1,3) g;
  insert into public.enfrentamientos (juego_id, rol) select id, 1 from public.juegos;
  insert into public.enfrentamiento_escuadras select en.id, e.id from public.enfrentamientos en, (select id from public.escuadras order by id limit 2) e;
  analyze;`);
const conteo = (await db.query(`select (select count(*) from public.sesion_escuadras)::int se, (select count(*) from public.calificaciones_tecnica)::int cal, (select count(*) from public.juegos)::int jue`)).rows[0];
console.log('   filas:', JSON.stringify(conteo));
const CONSULTAS = {
  'Q1 escuadras activas (listarEscuadras)': `select id, nombre from public.escuadras where activa = true order by id`,
  'Q2 calificaciones de una sesión (TecnicaRepositorio.cargar)': `select id, escuadra_id, version, fuerza, utilidad, firmeza, estabilidad, originalidad from public.calificaciones_tecnica where sesion_id = 60`,
  'Q3 ranking de una fecha (obtenerRanking)': `select escuadra, puntos_juegos, puntos_tecnica, puntos_formacion, total from public.ranking_general where fecha = date '2025-03-01' order by escuadra_id`,
  'Q4 última fecha con datos (obtenerRanking sin fecha)': `select fecha from public.ranking_general order by fecha desc limit 1`,
};
await db.exec(`select set_config('request.jwt.claim.sub', '${JEFA}', false); set role authenticated;`);
const tiempos = {};
for (const [nombre, sql] of Object.entries(CONSULTAS)) {
  const ms = [];
  for (let i = 0; i < 10; i++) { const a = t0(); await db.query(sql); ms.push(performance.now() - a); }
  const plan = (await db.query(`explain (analyze, buffers off, timing on) ${sql}`)).rows.map(x => x['QUERY PLAN']);
  tiempos[nombre] = { min: Math.min(...ms), max: Math.max(...ms), prom: ms.reduce((a, b) => a + b) / ms.length, plan };
  console.log(`\n${nombre}\n   10 ejecuciones: min ${tiempos[nombre].min.toFixed(2)} ms · prom ${tiempos[nombre].prom.toFixed(2)} ms · max ${tiempos[nombre].max.toFixed(2)} ms`);
  plan.forEach(l => console.log('   | ' + l));
}
await db.exec('reset role;');
writeFileSync(new URL('./wb_bd_tiempos.json', import.meta.url), JSON.stringify({ conteo, tiempos }, null, 1));
console.log(`\nResultado: ${fallas} casos marcados como FALLA (defectos o riesgos documentados)`);
