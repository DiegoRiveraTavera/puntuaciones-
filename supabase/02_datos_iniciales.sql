-- ════════════════════════════════════════════════════════════════════════
--  Puntuaciones — Datos iniciales
--  Ejecútalo DESPUÉS de crear tu primera cuenta de jefatura en
--  Authentication → Users → Add user.
--  Carga las 6 escuadras del Escuadrón Moriah, registradas a nombre de esa cuenta.
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  autor uuid := (select id from public.perfiles where rol = 'jefatura' and activo order by creado_en limit 1);
begin
  if autor is null then
    raise exception 'Primero crea una cuenta de jefatura en Authentication → Users → Add user';
  end if;

  insert into public.escuadras (nombre, creado_por)
  select n, autor
  from unnest(array['RRMS', 'ANK', 'ATL', 'MNS', 'SMN', 'SJN']) as n
  where not exists (select 1 from public.escuadras e where upper(trim(e.nombre)) = n);
end;
$$;

select id, nombre from public.escuadras order by id;
