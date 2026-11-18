-- ═══════════════════════════════════════════════════════════════════════════
-- PRÁCTICA 11 · White Box de la base de datos · Medición de consultas
-- Pégalo completo en Supabase → SQL Editor → Run. No modifica tus datos.
--
-- Ejecuta cada consulta de la app 3 veces con EXPLAIN ANALYZE:
--   · "como app": con el rol authenticated y tu usuario de jefatura (RLS activo),
--     igual que cuando la consulta llega desde el celular;
--   · "directo": como administrador (postgres), sin RLS.
-- Al final muestra una tabla: consulta, modo, tiempos y el plan completo.
-- ═══════════════════════════════════════════════════════════════════════════
create temp table if not exists wb_planes (consulta text, modo text, corrida int, n int, linea text);
truncate wb_planes;

do $$
declare
  uid uuid := (select id from public.perfiles where rol = 'jefatura' and activo order by creado_en limit 1);
  q record; m text; l text; lineas text[]; c int; i int;
begin
  if uid is null then raise exception 'No hay perfil de jefatura activo'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  for q in select * from (values
      ('Q1 escuadras activas (listarEscuadras)',
       'select id, nombre from public.escuadras where activa = true order by id'),
      ('Q2 calificaciones de la última sesión (TecnicaRepositorio.cargar)',
       'select id, escuadra_id, version, fuerza, utilidad, firmeza, estabilidad, originalidad from public.calificaciones_tecnica where sesion_id = (select max(id) from public.sesiones)'),
      ('Q3 ranking de la fecha más reciente (obtenerRanking)',
       'select escuadra, puntos_juegos, puntos_tecnica, puntos_formacion, total from public.ranking_general where fecha = (select max(fecha) from public.sesiones) order by escuadra_id'),
      ('Q4 juegos con enfrentamientos (JuegosRepositorio.cargar)',
       'select j.id, j.nombre, j.valor, e.id, e.rol, e.ganador_id, p.escuadra_id from public.juegos j left join public.enfrentamientos e on e.juego_id = j.id left join public.enfrentamiento_escuadras p on p.enfrentamiento_id = e.id where j.sesion_id = (select max(id) from public.sesiones)')
    ) v(nombre, sql)
  loop
    foreach m in array array['como app (RLS)', 'directo (sin RLS)'] loop
      for c in 1..3 loop
        lineas := '{}';
        if m like 'como app%' then execute 'set local role authenticated'; end if;
        for l in execute 'explain (analyze, buffers) ' || q.sql loop lineas := lineas || l; end loop;
        execute 'reset role';
        i := 0;
        foreach l in array lineas loop
          i := i + 1;
          insert into wb_planes values (q.nombre, m, c, i, l);
        end loop;
      end loop;
    end loop;
  end loop;
end $$;

-- Resultado: tiempos por corrida + plan completo de la 3.ª corrida
select consulta, modo, corrida,
       max(case when linea like 'Planning Time%' then linea end)  as planificacion,
       max(case when linea like 'Execution Time%' then linea end) as ejecucion,
       case when corrida = 3 then string_agg(linea, E'\n' order by n) end as plan
from wb_planes
group by consulta, modo, corrida
order by consulta, modo, corrida;
