-- ═══════════════════════════════════════════════════════════════════════════
-- PRÁCTICA 12 · Fase 4 · Pruebas avanzadas de base de datos (Supabase → SQL Editor → Run)
-- Córrelo DOS veces: antes y después de supabase/03_optimizacion_p12.sql, y descarga el CSV.
--
-- 1. Crea datos de prueba en la sesión 2099-12-30: 5,000 juegos con 1 enfrentamiento cada uno.
-- 2. Mide cada consulta 3 veces con EXPLAIN ANALYZE como la app (rol authenticated + RLS):
--    por id · conjunto pequeño · conjunto grande · con filtros · escuadras activas · ranking.
-- 3. Borra los datos de prueba y muestra los resultados (tiempos, filas, índices).
-- Tus datos reales no se modifican.
-- ═══════════════════════════════════════════════════════════════════════════
create temp table if not exists wb_p12 (consulta text, corrida int, filas bigint, planificacion_ms numeric, ejecucion_ms numeric,
                                        usa_indice boolean, rls_una_vez boolean, plan text);
truncate wb_p12;

do $$
declare
  jefa uuid := (select id from public.perfiles where rol = 'jefatura' and activo order by creado_en limit 1);
  ses bigint; esc1 bigint; esc2 bigint; uno bigint;
  q record; l text; lineas text[]; c int; plan text; filas bigint;
begin
  if jefa is null then raise exception 'No hay perfil de jefatura activo'; end if;
  select id into esc1 from public.escuadras order by id limit 1;
  select id into esc2 from public.escuadras order by id offset 1 limit 1;

  -- ── datos de prueba (como administrador)
  delete from public.sesiones where fecha = '2099-12-30';
  insert into public.sesiones (fecha, creado_por) values ('2099-12-30', jefa) returning id into ses;
  insert into public.sesion_escuadras values (ses, esc1), (ses, esc2);
  insert into public.juegos (sesion_id, nombre, valor, creado_por)
    select ses, 'J-' || g, 1 + (g % 100), jefa from generate_series(1, 5000) g;
  insert into public.enfrentamientos (juego_id, rol) select id, 1 from public.juegos where sesion_id = ses;
  insert into public.enfrentamiento_escuadras
    select e.id, x.esc from public.enfrentamientos e join public.juegos j on j.id = e.juego_id,
           (values (esc1), (esc2)) as x(esc) where j.sesion_id = ses;
  update public.enfrentamientos e set ganador_id = esc1 from public.juegos j where j.id = e.juego_id and j.sesion_id = ses;
  analyze public.juegos; analyze public.enfrentamientos; analyze public.enfrentamiento_escuadras;
  select min(id) + 2500 into uno from public.juegos where sesion_id = ses;

  -- ── mediciones como la app: rol authenticated con el usuario de jefatura (RLS activo)
  perform set_config('request.jwt.claims', json_build_object('sub', jefa, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', jefa::text, true);
  for q in select * from (values
      ('1 por id',             format('select id, nombre, valor from public.juegos where id = %s', uno)),
      ('2 conjunto pequeño',   format('select id, nombre, valor from public.juegos where sesion_id = %s order by id limit 10', ses)),
      ('3 conjunto grande',    format('select id, nombre, valor from public.juegos where sesion_id = %s', ses)),
      ('4 con filtros',        format('select id, nombre, valor from public.juegos where sesion_id = %s and valor >= 90 and nombre like %L order by valor desc limit 20', ses, 'J-1%')),
      ('5 grande con detalle', format('select j.id, e.id, e.ganador_id, p.escuadra_id from public.juegos j join public.enfrentamientos e on e.juego_id = j.id join public.enfrentamiento_escuadras p on p.enfrentamiento_id = e.id where j.sesion_id = %s', ses)),
      ('6 escuadras activas',  'select id, nombre from public.escuadras where activa = true order by id'),
      ('7 ranking de la sesión', format('select escuadra, puntos_juegos, total from public.ranking_general where sesion_id = %s', ses))
    ) v(nombre, sql)
  loop
    for c in 1..3 loop
      lineas := '{}';
      execute 'set local role authenticated';
      for l in execute 'explain (analyze, buffers) ' || q.sql loop lineas := lineas || l; end loop;
      execute 'reset role';
      plan := array_to_string(lineas, E'\n');
      filas := (regexp_match(lineas[1], 'rows=(\d+) loops'))[1]::bigint;
      insert into wb_p12 values (q.nombre, c, filas,
        (regexp_match(plan, 'Planning Time: ([\d.]+)'))[1]::numeric,
        (regexp_match(plan, 'Execution Time: ([\d.]+)'))[1]::numeric,
        plan ~ 'Index', plan ~ 'InitPlan', case when c = 3 then plan end);
    end loop;
  end loop;

  -- ── limpieza (en cascada: juegos, enfrentamientos y participantes)
  delete from public.sesiones where id = ses;
end $$;

select consulta, corrida, filas, planificacion_ms, ejecucion_ms, usa_indice, rls_una_vez, plan
from wb_p12 order by consulta, corrida;
