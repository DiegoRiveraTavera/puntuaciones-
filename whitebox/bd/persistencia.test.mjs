/**
 * PRÁCTICAS 13 y 14 — AUT-06 · Pruebas automatizadas de PERSISTENCIA
 *
 * Corre el esquema REAL de Supabase (supabase/01, 02 y 03) en PostgreSQL embebido (PGlite)
 * y prueba la operación de almacenamiento más crítica de la app: public.guardar_juego,
 * que la pantalla de Juegos llama en cada Guardar. No necesita internet ni la base real,
 * así que corre igual en la laptop y en GitHub Actions.
 *
 * Uso:  cd whitebox/bd && npm ci && npm run test:persistencia      (o desde la raíz: npm run test:bd)
 * Previene: DEF-01 (juego duplicado al reintentar) y DEF-02 (guardado a medias) de la P11.
 */
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const raiz = new URL('../../supabase/', import.meta.url);
const JEFA = '11111111-1111-1111-1111-111111111111';
const SUSPENDIDA = '22222222-2222-2222-2222-222222222222';
const FECHA = '2026-11-17';

// Lo mínimo de Supabase que el esquema necesita: roles, auth.uid(), storage y realtime
const ENTORNO_SUPABASE = `
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

let db;
/** Ejecuta SQL como lo haría la app: rol authenticated con el usuario indicado (RLS activo). */
async function como(usuario, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${usuario ?? ''}', false); set role ${usuario ? 'authenticated' : 'anon'};`);
  try { return (await db.query(sql)).rows; } finally { await db.exec('reset role;'); }
}
const comoJefa = (sql) => como(JEFA, sql);
const juego = (cambios = {}) => ({
  idCliente: 'aaaaaaaa-0000-4000-8000-000000000001', nombre: 'Relevos', valor: 20,
  roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ATL'], ganador: 'ANK' }, { escuadras: ['RRMS', 'MNS'], ganador: '' }] }],
  ...cambios,
});
const guardar = (j) => comoJefa(`select public.guardar_juego('${FECHA}', '${JSON.stringify(j).replace(/'/g, "''")}'::jsonb) as id`);
const puntos = async (escuadra) =>
  (await comoJefa(`select coalesce(sum(puntos_juegos), 0)::int as p from public.ranking_general where fecha = '${FECHA}' and escuadra = '${escuadra}'`))[0].p;

before(async () => {
  db = new PGlite();
  await db.exec(ENTORNO_SUPABASE);
  await db.exec(readFileSync(new URL('01_esquema_puntuaciones.sql', raiz), 'utf8'));
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
    ('${JEFA}', 'jefatura@moriah.com', '{"nombre":"Jefatura"}'), ('${SUSPENDIDA}', 'otra@moriah.com', '{}');
    update public.perfiles set activo = false where id = '${SUSPENDIDA}';`);
  await db.exec(readFileSync(new URL('02_datos_iniciales.sql', raiz), 'utf8'));
  await db.exec(readFileSync(new URL('03_optimizacion_p12.sql', raiz), 'utf8'));
});

describe('AUT-06 · Persistencia · public.guardar_juego sobre el esquema real', () => {
  let id;

  it('P-AUT-01 la operación de registro almacena el juego completo y el ganador cuenta en el ranking', async () => {
    [{ id }] = await guardar(juego());
    assert.ok(Number.isInteger(Number(id)), 'devuelve el id del juego');
    const [fila] = await comoJefa(`select j.nombre, j.valor, j.id_cliente::text,
        (select count(*)::int from public.enfrentamientos e where e.juego_id = j.id) as enfrentamientos,
        (select count(*)::int from public.enfrentamiento_escuadras p join public.enfrentamientos e on e.id = p.enfrentamiento_id where e.juego_id = j.id) as participaciones
      from public.juegos j where j.id = ${id}`);
    assert.deepEqual(fila, { nombre: 'Relevos', valor: 20, id_cliente: juego().idCliente, enfrentamientos: 2, participaciones: 4 });
    assert.equal(await puntos('ANK'), 20);
    assert.equal(await puntos('ATL'), 0);
  });

  it('P-AUT-02 idempotencia (DEF-01): la misma solicitud enviada dos veces deja UN solo juego', async () => {
    const [{ id: id2 }] = await guardar(juego());
    const [{ n }] = await comoJefa(`select count(*)::int as n from public.juegos where nombre = 'Relevos'`);
    assert.equal(id2, id, 'mismo id');
    assert.equal(n, 1, 'sin duplicado');
    assert.equal(await puntos('ANK'), 20, 'los puntos no se duplican');
  });

  it('P-AUT-03 transacción (DEF-02): un dato inválido rechaza todo y no deja el juego a medias', async () => {
    await assert.rejects(guardar(juego({ valor: 0, roles: [] })), (e) => e.code === '23514');
    const [{ enf }] = await comoJefa(`select count(*)::int as enf from public.enfrentamientos where juego_id = ${id}`);
    assert.equal(enf, 2, 'los enfrentamientos anteriores siguen ahí');
    assert.equal(await puntos('ANK'), 20, 'ANK conserva sus 20 puntos');
  });

  it('P-AUT-04 la base también valida: nombre vacío y nombre de 61 caracteres se rechazan', async () => {
    await assert.rejects(guardar(juego({ idCliente: 'aaaaaaaa-0000-4000-8000-000000000002', nombre: '   ' })), (e) => e.code === '23514');
    await assert.rejects(guardar(juego({ idCliente: 'aaaaaaaa-0000-4000-8000-000000000003', nombre: 'J'.repeat(61) })), (e) => e.code === '23514');
    const [{ n }] = await comoJefa(`select count(*)::int as n from public.juegos`);
    assert.equal(n, 1, 'solo existe el juego válido');
  });

  it('P-AUT-05 al editar, el cambio de ganador se guarda y el ranking se actualiza', async () => {
    await guardar(juego({ roles: [{ numero: 1, enfrentamientos: [{ escuadras: ['ANK', 'ATL'], ganador: 'ATL' }] }] }));
    assert.equal(await puntos('ATL'), 20);
    assert.equal(await puntos('ANK'), 0);
  });

  it('P-AUT-06 permisos: una cuenta suspendida y un usuario sin sesión no pueden guardar', async () => {
    await assert.rejects(como(SUSPENDIDA, `select public.guardar_juego('${FECHA}', '${JSON.stringify(juego({ idCliente: 'aaaaaaaa-0000-4000-8000-000000000009' }))}'::jsonb)`),
      (e) => e.code === '42501');
    await assert.rejects(como(null, `select public.guardar_juego('${FECHA}', '${JSON.stringify(juego())}'::jsonb)`));
  });
});
