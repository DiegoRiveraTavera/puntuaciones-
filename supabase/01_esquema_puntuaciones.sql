-- ════════════════════════════════════════════════════════════════════════
--  Puntuaciones · Escuadrón Moriah — Esquema de base de datos (Supabase)
--
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run.
--  Ejecútalo UNA sola vez en un proyecto vacío.
--
--  Quién puede usar la app: solo la jefatura, que puede hacer todo.
--  Cómo se garantiza:
--    1. El registro público se desactiva en Authentication; las cuentas
--       de jefatura se crean a mano desde el panel de Supabase.
--    2. Al crearse una cuenta, se crea su perfil con rol 'jefatura'.
--    3. Todas las tablas tienen Row Level Security (RLS): sin una sesión
--       de jefatura activa no se puede leer ni escribir nada.
-- ════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────── 1. PERFILES ───────────────────────────────
-- Un perfil por cada cuenta de Supabase Auth.
create table public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null default '',
  rol        text not null default 'jefatura' check (rol in ('jefatura')),
  activo     boolean not null default true,      -- false = cuenta suspendida
  creado_en  timestamptz not null default now()
);

-- Crea el perfil automáticamente cuando se agrega una cuenta en Authentication
create function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ¿La sesión actual es de una cuenta de jefatura activa?
create function public.es_jefatura()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'jefatura' and activo
  );
$$;


-- ─────────────────────── 2. TABLAS DEL DOMINIO ───────────────────────

-- Día de actividad (cada sábado). Agrupa todo lo que se califica ese día.
create table public.sesiones (
  id          bigint generated always as identity primary key,
  fecha       date not null unique,
  creado_por  uuid not null default auth.uid() references public.perfiles (id),
  creado_en   timestamptz not null default now()
);

create table public.escuadras (
  id              bigint generated always as identity primary key,
  nombre          text not null check (char_length(trim(nombre)) between 1 and 20),
  descripcion     text,
  activa          boolean not null default true,
  creado_por      uuid not null default auth.uid() references public.perfiles (id),
  creado_en       timestamptz not null default now()
);
-- REQ-08: no se repite una escuadra aunque cambien mayúsculas o espacios (RRMS = rrms)
create unique index escuadras_nombre_unico on public.escuadras (upper(trim(nombre)));

-- Escuadras que participan en una sesión (pantalla Inicio)
create table public.sesion_escuadras (
  sesion_id    bigint not null references public.sesiones (id) on delete cascade,
  escuadra_id  bigint not null references public.escuadras (id) on delete cascade,
  primary key (sesion_id, escuadra_id)
);

create table public.integrantes (
  id           bigint generated always as identity primary key,
  escuadra_id  bigint not null references public.escuadras (id) on delete cascade,
  nombre       text not null check (char_length(trim(nombre)) between 1 and 80),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

-- ── Técnica: 5 criterios del 1 al 10 (REQ-09 validado también en el servidor)
create table public.calificaciones_tecnica (
  id               bigint generated always as identity primary key,
  sesion_id        bigint not null references public.sesiones (id) on delete cascade,
  escuadra_id      bigint not null references public.escuadras (id) on delete cascade,
  fuerza           smallint not null check (fuerza between 1 and 10),
  utilidad         smallint not null check (utilidad between 1 and 10),
  firmeza          smallint not null check (firmeza between 1 and 10),
  estabilidad      smallint not null check (estabilidad between 1 and 10),
  originalidad     smallint not null check (originalidad between 1 and 10),
  total            smallint generated always as (fuerza + utilidad + firmeza + estabilidad + originalidad) stored,
  observaciones    text,
  version          integer not null default 1,      -- control de conflictos (Práctica 9)
  creado_por       uuid not null default auth.uid() references public.perfiles (id),
  actualizado_por  uuid references public.perfiles (id),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (sesion_id, escuadra_id)                    -- una calificación por escuadra y día
);

-- ── Fotografías de técnica: el archivo vive en Storage; aquí solo su ruta
create table public.fotografias (
  id                bigint generated always as identity primary key,
  escuadra_id       bigint not null references public.escuadras (id) on delete cascade,
  sesion_id         bigint not null references public.sesiones (id) on delete cascade,
  calificacion_id   bigint references public.calificaciones_tecnica (id) on delete set null,
  ruta_archivo      text not null unique,            -- ruta dentro del bucket 'fotos-tecnica'
  descripcion       text,
  creado_por        uuid not null default auth.uid() references public.perfiles (id),
  creado_en         timestamptz not null default now()
);

-- ── Formación
create table public.formacion (
  id               bigint generated always as identity primary key,
  sesion_id        bigint not null references public.sesiones (id) on delete cascade,
  escuadra_id      bigint not null references public.escuadras (id) on delete cascade,
  uniforme_jefe    boolean not null default false,
  banderin         boolean not null default false,
  bandera          boolean not null default false,
  escudo           boolean not null default false,
  bolsa            boolean not null default false,
  botiquin         boolean not null default false,
  biblia           boolean not null default false,
  mat_tecnica      integer not null default 0 check (mat_tecnica >= 0),
  mat_quizz        integer not null default 0 check (mat_quizz >= 0),
  mat_juegos       integer not null default 0 check (mat_juegos >= 0),
  cuotas           numeric(10,2) not null default 0 check (cuotas >= 0),
  adeudo           numeric(10,2) not null default 0 check (adeudo >= 0),
  puntos           integer not null default 0 check (puntos >= 0),
  version          integer not null default 1,
  creado_por       uuid not null default auth.uid() references public.perfiles (id),
  actualizado_por  uuid references public.perfiles (id),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (sesion_id, escuadra_id)
);

create table public.formacion_miembros (
  formacion_id  bigint not null references public.formacion (id) on delete cascade,
  posicion      smallint not null check (posicion between 1 and 14),
  nombre        text not null default '',
  uniforme      boolean not null default false,
  cursos        text not null default '',
  pruebas       text not null default '',
  primary key (formacion_id, posicion)
);

-- ── Juegos
create table public.juegos (
  id          bigint generated always as identity primary key,
  sesion_id   bigint not null references public.sesiones (id) on delete cascade,
  nombre      text not null check (char_length(trim(nombre)) between 1 and 60),
  valor       integer not null check (valor > 0),    -- REQ-10: valor mayor que 0
  creado_por  uuid not null default auth.uid() references public.perfiles (id),
  creado_en   timestamptz not null default now()
);

create table public.enfrentamientos (
  id           bigint generated always as identity primary key,
  juego_id     bigint not null references public.juegos (id) on delete cascade,
  rol          smallint not null check (rol >= 1),
  ganador_id   bigint references public.escuadras (id) on delete set null,
  creado_en    timestamptz not null default now()
);

create table public.enfrentamiento_escuadras (
  enfrentamiento_id  bigint not null references public.enfrentamientos (id) on delete cascade,
  escuadra_id        bigint not null references public.escuadras (id) on delete cascade,
  primary key (enfrentamiento_id, escuadra_id)
);


-- ───────────────────── 3. REGLAS DE INTEGRIDAD (triggers) ─────────────────────

-- Registra quién y cuándo modificó, y aumenta la versión en cada cambio
create function public.marcar_actualizacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_por := auth.uid();
  new.actualizado_en  := now();
  new.version         := old.version + 1;
  new.creado_por      := old.creado_por;   -- el autor original no se puede cambiar
  new.creado_en       := old.creado_en;
  return new;
end;
$$;

create trigger tecnica_actualizada before update on public.calificaciones_tecnica
  for each row execute function public.marcar_actualizacion();
create trigger formacion_actualizada before update on public.formacion
  for each row execute function public.marcar_actualizacion();

-- El ganador de un enfrentamiento debe ser una de sus escuadras
create function public.validar_ganador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ganador_id is not null and not exists (
    select 1 from public.enfrentamiento_escuadras
    where enfrentamiento_id = new.id and escuadra_id = new.ganador_id
  ) then
    raise exception 'El ganador debe participar en el enfrentamiento'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger ganador_valido before insert or update of ganador_id on public.enfrentamientos
  for each row execute function public.validar_ganador();

-- REQ-12: si se quita del enfrentamiento a la escuadra ganadora, pierde la victoria
create function public.limpiar_ganador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.enfrentamientos
     set ganador_id = null
   where id = old.enfrentamiento_id and ganador_id = old.escuadra_id;
  return old;
end;
$$;

create trigger ganador_quitado after delete on public.enfrentamiento_escuadras
  for each row execute function public.limpiar_ganador();


-- ─────────────────────────── 4. RANKING GENERAL ───────────────────────────
-- Puntos de cada escuadra por sesión (para Lugares y Estadísticas).
-- security_invoker = respeta las reglas RLS de quien consulta.
create view public.ranking_general
with (security_invoker = true)
as
select
  s.id                                          as sesion_id,
  s.fecha,
  e.id                                          as escuadra_id,
  e.nombre                                      as escuadra,
  coalesce(j.puntos, 0)                         as puntos_juegos,
  coalesce(t.total, 0)                          as puntos_tecnica,
  coalesce(f.puntos, 0)                         as puntos_formacion,
  coalesce(j.puntos, 0) + coalesce(t.total, 0) + coalesce(f.puntos, 0) as total
from public.sesion_escuadras se
join public.sesiones  s on s.id = se.sesion_id
join public.escuadras e on e.id = se.escuadra_id
left join public.calificaciones_tecnica t on t.sesion_id = s.id and t.escuadra_id = e.id
left join public.formacion f              on f.sesion_id = s.id and f.escuadra_id = e.id
left join lateral (
  select sum(jg.valor) as puntos
  from public.juegos jg
  join public.enfrentamientos en on en.juego_id = jg.id
  where jg.sesion_id = s.id and en.ganador_id = e.id
) j on true;


-- ───────────────────── 5. SEGURIDAD: ROW LEVEL SECURITY ─────────────────────
alter table public.perfiles                 enable row level security;
alter table public.sesiones                 enable row level security;
alter table public.escuadras                enable row level security;
alter table public.sesion_escuadras         enable row level security;
alter table public.integrantes              enable row level security;
alter table public.calificaciones_tecnica   enable row level security;
alter table public.fotografias              enable row level security;
alter table public.formacion                enable row level security;
alter table public.formacion_miembros       enable row level security;
alter table public.juegos                   enable row level security;
alter table public.enfrentamientos          enable row level security;
alter table public.enfrentamiento_escuadras enable row level security;

-- Perfiles: la jefatura puede verlos; nadie los crea ni borra desde la app
-- (los crea el trigger) y cada quien solo puede cambiar su propio nombre.
create policy "jefatura ve perfiles" on public.perfiles
  for select to authenticated using (public.es_jefatura());
create policy "cada quien edita su perfil" on public.perfiles
  for update to authenticated
  using (id = auth.uid() and public.es_jefatura())
  with check (id = auth.uid() and rol = 'jefatura' and activo);

-- Tablas con autor (creado_por): la jefatura hace todo, pero al crear un
-- registro el autor debe ser la propia cuenta (evita la suplantación).
do $$
declare t text;
begin
  foreach t in array array['sesiones','escuadras','calificaciones_tecnica','fotografias','formacion','juegos'] loop
    execute format('create policy "jefatura lee" on public.%I for select to authenticated using (public.es_jefatura())', t);
    execute format('create policy "jefatura crea a su nombre" on public.%I for insert to authenticated with check (public.es_jefatura() and creado_por = auth.uid())', t);
    execute format('create policy "jefatura modifica" on public.%I for update to authenticated using (public.es_jefatura()) with check (public.es_jefatura())', t);
    execute format('create policy "jefatura elimina" on public.%I for delete to authenticated using (public.es_jefatura())', t);
  end loop;

  -- Tablas sin autor: la jefatura hace todo
  foreach t in array array['sesion_escuadras','integrantes','formacion_miembros','enfrentamientos','enfrentamiento_escuadras'] loop
    execute format('create policy "jefatura todo" on public.%I for all to authenticated using (public.es_jefatura()) with check (public.es_jefatura())', t);
  end loop;
end;
$$;

-- Sin sesión (rol anon) no hay ninguna política: no se puede leer ni escribir nada.
revoke all on all tables in schema public from anon;


-- ─────────────────────── 6. FOTOS (Supabase Storage) ───────────────────────
insert into storage.buckets (id, name, public)
values ('fotos-tecnica', 'fotos-tecnica', false)
on conflict (id) do nothing;

create policy "jefatura lee fotos" on storage.objects
  for select to authenticated using (bucket_id = 'fotos-tecnica' and public.es_jefatura());
create policy "jefatura sube fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos-tecnica' and public.es_jefatura());
create policy "jefatura borra fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos-tecnica' and public.es_jefatura());


-- ─────────────────────── 7. TIEMPO REAL (Práctica 9) ───────────────────────
-- Los cambios en estas tablas llegan al instante a los demás celulares.
alter publication supabase_realtime add table
  public.escuadras, public.sesion_escuadras, public.calificaciones_tecnica,
  public.fotografias, public.formacion, public.juegos,
  public.enfrentamientos, public.enfrentamiento_escuadras;


-- ─────────────────────────── 8. ÍNDICES ───────────────────────────
create index on public.calificaciones_tecnica (sesion_id);
create index on public.fotografias (escuadra_id, sesion_id);
create index on public.formacion (sesion_id);
create index on public.juegos (sesion_id);
create index on public.enfrentamientos (juego_id);
create index on public.enfrentamientos (ganador_id);
create index on public.integrantes (escuadra_id);
