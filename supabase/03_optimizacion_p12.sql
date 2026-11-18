-- ═══════════════════════════════════════════════════════════════════════════
-- PRÁCTICA 12 · Optimización (ejecutar UNA vez en Supabase → SQL Editor → Run)
--
-- 1. Guardar un juego en UNA sola llamada y en UNA transacción
--    (antes: ~9 peticiones en serie, sin transacción → DEF-01 y DEF-02 de la P11).
-- 2. Idempotencia: cada juego lleva un id creado en la app (id_cliente); si la
--    misma solicitud llega dos veces, se actualiza el mismo juego, no se duplica.
-- 3. Políticas RLS: (select public.es_jefatura()) se evalúa UNA vez por consulta
--    en lugar de una vez por fila.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Id generado por la app para cada juego (llave de idempotencia)
alter table public.juegos add column if not exists id_cliente uuid;
create unique index if not exists juegos_id_cliente_key on public.juegos (id_cliente);

-- ── 2. Guardado completo de un juego (juego + enfrentamientos + participantes + ganador)
--    p_juego = { "id"?: number, "idCliente": uuid, "nombre": text, "valor": int,
--                "roles": [ { "numero": int, "enfrentamientos": [ { "escuadras": [text], "ganador": text } ] } ] }
--    security invoker → se aplican las mismas reglas RLS que a la app.
create or replace function public.guardar_juego(p_fecha date, p_juego jsonb)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sesion   bigint;
  v_juego    bigint;
  v_cliente  uuid   := nullif(p_juego->>'idCliente', '')::uuid;
  v_rol      jsonb;
  v_enf      jsonb;
  v_enf_id   bigint;
  v_nombre   text;
  v_esc      bigint;
  v_ganador  bigint;
begin
  if not public.es_jefatura() then
    raise exception 'Tu cuenta no tiene permiso para guardar juegos' using errcode = '42501';
  end if;
  if v_cliente is null and (p_juego->>'id') is null then
    raise exception 'Falta el identificador del juego' using errcode = '22023';
  end if;

  -- Sesión del día (se crea si no existe)
  insert into public.sesiones (fecha) values (p_fecha) on conflict (fecha) do nothing;
  select id into v_sesion from public.sesiones where fecha = p_fecha;

  -- Juego: por id (juegos ya guardados) o por id_cliente (idempotente)
  if (p_juego->>'id') is not null then
    update public.juegos
       set nombre = p_juego->>'nombre',
           valor = (p_juego->>'valor')::int,
           id_cliente = coalesce(id_cliente, v_cliente)
     where id = (p_juego->>'id')::bigint
    returning id into v_juego;
  end if;
  if v_juego is null then
    insert into public.juegos (sesion_id, nombre, valor, id_cliente)
    values (v_sesion, p_juego->>'nombre', (p_juego->>'valor')::int, v_cliente)
    on conflict (id_cliente) do update
      set nombre = excluded.nombre, valor = excluded.valor
    returning id into v_juego;
  end if;

  -- Enfrentamientos: se reemplazan dentro de la MISMA transacción
  delete from public.enfrentamientos where juego_id = v_juego;

  for v_rol in select value from jsonb_array_elements(coalesce(p_juego->'roles', '[]'::jsonb)) loop
    for v_enf in select value from jsonb_array_elements(coalesce(v_rol->'enfrentamientos', '[]'::jsonb)) loop
      insert into public.enfrentamientos (juego_id, rol)
      values (v_juego, (v_rol->>'numero')::smallint)
      returning id into v_enf_id;

      v_ganador := null;
      for v_nombre in
        select distinct trim(t.nombre)
          from jsonb_array_elements_text(coalesce(v_enf->'escuadras', '[]'::jsonb)) as t(nombre)
         where trim(t.nombre) <> ''
      loop
        v_esc := null;
        select id into v_esc from public.escuadras where upper(trim(nombre)) = upper(v_nombre);
        if v_esc is null then
          insert into public.escuadras (nombre) values (v_nombre) returning id into v_esc;
        end if;
        insert into public.sesion_escuadras (sesion_id, escuadra_id)
        values (v_sesion, v_esc) on conflict do nothing;
        insert into public.enfrentamiento_escuadras (enfrentamiento_id, escuadra_id)
        values (v_enf_id, v_esc) on conflict do nothing;
        if upper(v_nombre) = upper(trim(coalesce(v_enf->>'ganador', ''))) then
          v_ganador := v_esc;
        end if;
      end loop;

      if v_ganador is not null then
        update public.enfrentamientos set ganador_id = v_ganador where id = v_enf_id;
      end if;
    end loop;
  end loop;

  return v_juego;
end;
$$;

revoke all on function public.guardar_juego(date, jsonb) from public, anon;
grant execute on function public.guardar_juego(date, jsonb) to authenticated;

-- ── 3. Políticas RLS: la función se evalúa una vez por consulta (initPlan)
drop policy if exists "jefatura ve perfiles" on public.perfiles;
create policy "jefatura ve perfiles" on public.perfiles
  for select to authenticated using ((select public.es_jefatura()));
drop policy if exists "cada quien edita su perfil" on public.perfiles;
create policy "cada quien edita su perfil" on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()) and (select public.es_jefatura()))
  with check (id = (select auth.uid()) and rol = 'jefatura' and activo);

do $$
declare t text;
begin
  foreach t in array array['sesiones','escuadras','calificaciones_tecnica','fotografias','formacion','juegos'] loop
    execute format('drop policy if exists "jefatura lee" on public.%I', t);
    execute format('drop policy if exists "jefatura crea a su nombre" on public.%I', t);
    execute format('drop policy if exists "jefatura modifica" on public.%I', t);
    execute format('drop policy if exists "jefatura elimina" on public.%I', t);
    execute format('create policy "jefatura lee" on public.%I for select to authenticated using ((select public.es_jefatura()))', t);
    execute format('create policy "jefatura crea a su nombre" on public.%I for insert to authenticated with check ((select public.es_jefatura()) and creado_por = (select auth.uid()))', t);
    execute format('create policy "jefatura modifica" on public.%I for update to authenticated using ((select public.es_jefatura())) with check ((select public.es_jefatura()))', t);
    execute format('create policy "jefatura elimina" on public.%I for delete to authenticated using ((select public.es_jefatura()))', t);
  end loop;

  foreach t in array array['sesion_escuadras','integrantes','formacion_miembros','enfrentamientos','enfrentamiento_escuadras'] loop
    execute format('drop policy if exists "jefatura todo" on public.%I', t);
    execute format('create policy "jefatura todo" on public.%I for all to authenticated using ((select public.es_jefatura())) with check ((select public.es_jefatura()))', t);
  end loop;
end;
$$;
