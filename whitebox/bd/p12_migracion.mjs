/**
 * PRÁCTICA 12 — Prueba de la migración 03_optimizacion_p12.sql sobre el esquema real
 * en PostgreSQL embebido (PGlite), antes de aplicarla en Supabase.
 * Uso:  cd whitebox/bd  &&  npm install  &&  node p12_migracion.mjs
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
await db.exec(readFileSync(new URL('../../supabase/03_optimizacion_p12.sql', import.meta.url), 'utf8'));
console.log('\nMigración 03 aplicada sin errores\n');

const J = (sql) => como('authenticated', JEFA, sql);
const juego = (extra = {}) => JSON.stringify({ idCliente: 'aaaaaaaa-0000-4000-8000-000000000001', nombre: 'Relevos', valor: 20,
  roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ATL'], ganador: 'ANK' }, { escuadras: ['RRMS', 'MNS'], ganador: '' }] }], ...extra });
const puntos = async (esc) => (await J(`select coalesce(sum(puntos_juegos),0)::int p from public.ranking_general where fecha = '2026-11-14' and escuadra = '${esc}'`)).rows?.[0]?.p;

let r = await J(`select public.guardar_juego('2026-11-14', '${juego()}'::jsonb) id`);
caso('M-01', 'guardar un juego nuevo en una sola llamada', r.ok, r.ok ? `id ${r.rows[0].id}` : r.err);
const id1 = r.rows?.[0]?.id;
r = await J(`select (select count(*) from public.enfrentamientos e join public.juegos j on j.id = e.juego_id where j.id = ${id1})::int enf,
               (select count(*) from public.enfrentamiento_escuadras p join public.enfrentamientos e on e.id = p.enfrentamiento_id where e.juego_id = ${id1})::int part`);
caso('M-02', 'crea 2 enfrentamientos y 4 participaciones', r.rows[0].enf === 2 && r.rows[0].part === 4, JSON.stringify(r.rows[0]));
caso('M-03', 'el ganador cuenta en el ranking (ANK = 20 pts)', (await puntos('ANK')) === 20, `ANK ${await puntos('ANK')}`);

r = await J(`select public.guardar_juego('2026-11-14', '${juego()}'::jsonb) id`);
const n = (await J(`select count(*)::int n from public.juegos where nombre = 'Relevos'`)).rows[0].n;
caso('M-04', 'IDEMPOTENCIA: la misma solicitud dos veces → mismo juego, sin duplicado', r.rows?.[0]?.id === id1 && n === 1, `id ${r.rows?.[0]?.id}, juegos "Relevos": ${n}`);

r = await J(`select public.guardar_juego('2026-11-14', '${juego({ valor: 0 })}'::jsonb) id`);
caso('M-05', 'TRANSACCIÓN: un dato inválido (valor 0) rechaza todo...', !r.ok, r.err);
caso('M-06', '...y no deja nada a medias: ANK conserva sus 20 pts', (await puntos('ANK')) === 20, `ANK ${await puntos('ANK')}`);

r = await J(`select public.guardar_juego('2026-11-14', '${juego({ roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ATL'], ganador: 'ATL' }] }] })}'::jsonb) id`);
caso('M-07', 'editar el juego: el ganador cambia a ATL', r.ok && (await puntos('ATL')) === 20 && (await puntos('ANK')) === 0, `ATL ${await puntos('ATL')}, ANK ${await puntos('ANK')}`);

r = await J(`select public.guardar_juego('2026-11-14', '${juego({ idCliente: 'aaaaaaaa-0000-4000-8000-000000000002', nombre: 'Cuerda', valor: 5, roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['Nueva Escuadra', 'ANK'], ganador: 'Nueva Escuadra' }] }] })}'::jsonb) id`);
const nueva = (await J(`select count(*)::int n from public.escuadras where nombre = 'Nueva Escuadra'`)).rows[0].n;
caso('M-08', 'una escuadra que no existe se crea y entra a la sesión', r.ok && nueva === 1 && (await puntos('Nueva Escuadra')) === 5, r.err ?? `creada: ${nueva}`);

const viejo = (await J(`insert into public.juegos (sesion_id, nombre, valor) select id, 'Viejo', 10 from public.sesiones where fecha = '2026-11-14' returning id`)).rows[0].id;
r = await J(`select public.guardar_juego('2026-11-14', '${JSON.stringify({ id: viejo, idCliente: 'aaaaaaaa-0000-4000-8000-000000000003', nombre: 'Viejo', valor: 10, roles: [] })}'::jsonb) id`);
const conCliente = (await J(`select id_cliente from public.juegos where id = ${viejo}`)).rows[0].id_cliente;
caso('M-09', 'un juego guardado antes de la migración (sin id_cliente) se actualiza por id y recibe su id_cliente', r.rows?.[0]?.id === viejo && conCliente !== null, `id ${r.rows?.[0]?.id}`);

r = await como('authenticated', OTRO, `select public.guardar_juego('2026-11-14', '${juego({ idCliente: 'aaaaaaaa-0000-4000-8000-000000000009' })}'::jsonb)`);
caso('M-10', 'una cuenta que no es jefatura no puede guardar (42501)', !r.ok && /permiso/.test(r.err), r.err);
r = await como('anon', null, `select public.guardar_juego('2026-11-14', '${juego()}'::jsonb)`);
caso('M-11', 'sin sesión (anon) no puede ejecutar la función', !r.ok, r.err);

// Políticas RLS: la función ahora aparece como InitPlan (una vez) y no como filtro por fila
await db.exec(`analyze; select set_config('request.jwt.claim.sub', '${JEFA}', false); set role authenticated;`);
const plan = (await db.query(`explain select id, nombre from public.escuadras where activa = true order by id`)).rows.map(x => x['QUERY PLAN']).join('\n');
await db.exec('reset role;');
caso('M-12', 'RLS: es_jefatura() se evalúa una vez (InitPlan), no por fila', /InitPlan/.test(plan), '\n' + plan);
console.log(`\nResultado: ${fallas} fallas`);
