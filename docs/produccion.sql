-- =============================================================================
-- Esquema completo para el proyecto de PRODUCCIÓN
--
-- Generado concatenando supabase/migrations/ en orden. Pégalo entero en el
-- SQL Editor de Supabase y ejecútalo de una vez.
--
-- IMPORTANTE: crea antes la cuenta en Authentication → Users → Add user.
-- La 0005 siembra el catálogo a la PRIMERA cuenta de la base. Para las demás,
-- la 0007 deja una función a la que se llama por email:
--
--   select public.sembrar_catalogo_ejercicios('otra@cuenta.com');
--
-- Todo es idempotente salvo los CREATE TABLE: si el esquema ya está puesto y
-- solo falta una migración nueva, pega únicamente ese bloque.
-- =============================================================================


-- ####################  0001_esquema.sql  ####################

-- =============================================================================
-- 0001 · Esquema base
--
-- Convenciones aplicadas a todas las tablas de datos del usuario:
--   · id uuid con valor por defecto, pero el cliente SIEMPRE lo envía. Es lo
--     que permite crear filas sin conexión (una sesión y sus series se
--     relacionan antes de existir en el servidor) y hace que reintentar un
--     envío sea idempotente: el mismo id no duplica la fila.
--   · user_id con default auth.uid(), para no depender de que el cliente lo
--     recuerde en cada insert.
--   · updated_at mantenido por trigger. La sincronización es "última escritura
--     gana" y necesita un reloj del lado del servidor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- Entrenamiento
-- =============================================================================

create table public.ejercicios (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  nombre          text not null,
  grupo_muscular  text check (grupo_muscular in ('pecho','espalda','pierna','hombro','biceps','triceps','core')),
  equipamiento    text check (equipamiento in ('barra','mancuerna','maquina','polea','peso_corporal')),
  es_unilateral   boolean not null default false,
  notas           text,
  -- Un ejercicio con histórico no se borra, se archiva: dejaría series huérfanas.
  archivado       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index ejercicios_nombre_unico
  on public.ejercicios (user_id, lower(nombre));

create table public.rutinas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  nombre        text not null,
  activa        boolean not null default false,
  fecha_inicio  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- "Solo una activa a la vez" se garantiza en la base de datos, no en la app.
create unique index rutinas_una_sola_activa
  on public.rutinas (user_id)
  where activa;

create table public.rutina_dias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  rutina_id   uuid not null references public.rutinas on delete cascade,
  nombre      text not null,
  orden       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index rutina_dias_por_rutina on public.rutina_dias (rutina_id, orden);

create table public.rutina_ejercicios (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  dia_id           uuid not null references public.rutina_dias on delete cascade,
  ejercicio_id     uuid not null references public.ejercicios on delete restrict,
  orden            int not null default 0,
  series_objetivo  int,
  reps_objetivo    text,          -- admite rangos: "8-10"
  rir_objetivo     int,
  descanso_seg     int,
  notas            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index rutina_ejercicios_por_dia on public.rutina_ejercicios (dia_id, orden);

create table public.sesiones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  -- set null, no cascade: reescribir o borrar una rutina no puede llevarse por
  -- delante el histórico de sesiones ya entrenadas.
  dia_id       uuid references public.rutina_dias on delete set null,
  -- Copia del nombre del día, para que la sesión siga siendo legible aunque
  -- la rutina que la originó ya no exista.
  nombre_dia   text,
  fecha        date not null,
  hora_inicio  timestamptz,
  hora_fin     timestamptz,
  notas        text,
  sensacion    int check (sensacion between 1 and 5),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index sesiones_por_fecha on public.sesiones (user_id, fecha desc);

create table public.series (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  sesion_id     uuid not null references public.sesiones on delete cascade,
  -- Decisión crítica del plan: la serie apunta al ejercicio, nunca a
  -- rutina_ejercicios. Permite salirse del plan y reescribir rutinas.
  ejercicio_id  uuid not null references public.ejercicios on delete restrict,
  numero        int not null default 1,
  peso_kg       numeric(6,2),
  reps          int,
  rir           int,
  tipo          text not null default 'normal'
                check (tipo in ('normal','calentamiento','dropset','fallo')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Índice de la consulta más caliente de la app: "qué hice la última vez en
-- este ejercicio". Se resuelve en 0003_funciones.sql.
create index series_por_ejercicio on public.series (user_id, ejercicio_id);
create index series_por_sesion on public.series (sesion_id, numero);

-- =============================================================================
-- Nutrición
-- =============================================================================

create table public.alimentos (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  nombre           text not null,
  marca            text,
  codigo_barras    text,
  kcal_100g        numeric(7,2) not null,
  proteina_100g    numeric(7,2) not null,
  grasa_100g       numeric(7,2) not null,
  carbos_100g      numeric(7,2) not null,
  fibra_100g       numeric(7,2),
  azucar_100g      numeric(7,2),
  sal_100g         numeric(7,3),
  porcion_defecto_g numeric(7,2),
  origen           text not null default 'manual'
                   check (origen in ('manual','openfoodfacts','importado')),
  favorito         boolean not null default false,
  veces_usado      int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index alimentos_codigo_barras_unico
  on public.alimentos (user_id, codigo_barras)
  where codigo_barras is not null;

-- El buscador ordena por uso descendente; es la vía principal de registro.
create index alimentos_por_uso on public.alimentos (user_id, veces_usado desc);

create table public.recetas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  nombre      text not null,
  porciones   numeric(6,2) not null default 1 check (porciones > 0),
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.receta_ingredientes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  receta_id    uuid not null references public.recetas on delete cascade,
  alimento_id  uuid not null references public.alimentos on delete restrict,
  gramos       numeric(7,2) not null check (gramos > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index receta_ingredientes_por_receta on public.receta_ingredientes (receta_id);

create table public.registros_comida (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  fecha        date not null,
  momento      text not null check (momento in ('desayuno','almuerzo','cena','snack')),
  -- set null: corregir la biblioteca no puede borrar el diario.
  alimento_id  uuid references public.alimentos on delete set null,
  receta_id    uuid references public.recetas on delete set null,
  descripcion  text,
  gramos       numeric(7,2),
  -- Decisión crítica del plan: los macros se guardan congelados en el propio
  -- registro y no se recalculan al leer. Editar una ficha de alimento no debe
  -- reescribir el pasado.
  kcal         numeric(7,2) not null,
  proteina     numeric(7,2) not null,
  grasa        numeric(7,2) not null,
  carbos       numeric(7,2) not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Un registro sin alimento, sin receta y sin descripción no es legible.
  constraint registros_comida_identificable
    check (alimento_id is not null or receta_id is not null or descripcion is not null)
);

create index registros_comida_por_fecha on public.registros_comida (user_id, fecha);

create table public.objetivos_nutricionales (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  tipo_dia       text not null check (tipo_dia in ('entreno','descanso')),
  kcal           numeric(7,2) not null,
  proteina_g     numeric(7,2) not null,
  grasa_g        numeric(7,2) not null,
  carbos_g       numeric(7,2) not null,
  -- Histórico por fecha de vigencia: el objetivo de hoy no debe reescribir con
  -- qué objetivo se comparaba hace tres meses.
  vigente_desde  date not null default current_date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index objetivos_vigencia_unica
  on public.objetivos_nutricionales (user_id, tipo_dia, vigente_desde);

create table public.dias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  fecha       date not null,
  tipo        text not null check (tipo in ('entreno','descanso')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index dias_fecha_unica on public.dias (user_id, fecha);

-- =============================================================================
-- Corporal
-- =============================================================================

create table public.medidas_corporales (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  fecha       date not null,
  peso_kg     numeric(5,2),
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un pesaje por día: permite registrar el peso de la mañana con un upsert.
create unique index medidas_fecha_unica on public.medidas_corporales (user_id, fecha);

create table public.fotos_progreso (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  fecha          date not null,
  ruta_storage   text not null,
  angulo         text check (angulo in ('frontal','lateral','espalda')),
  peso_kg        numeric(5,2),   -- copia del peso de ese día
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index fotos_por_fecha on public.fotos_progreso (user_id, fecha desc);

-- =============================================================================
-- Trigger de updated_at en todas las tablas anteriores
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'ejercicios','rutinas','rutina_dias','rutina_ejercicios','sesiones','series',
    'alimentos','recetas','receta_ingredientes','registros_comida',
    'objetivos_nutricionales','dias','medidas_corporales','fotos_progreso'
  ] loop
    execute format(
      'create trigger %I_tocar_updated_at
         before update on public.%I
         for each row execute function public.tocar_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ####################  0002_rls.sql  ####################

-- =============================================================================
-- 0002 · Row Level Security
--
-- La app no tiene backend: la clave anónima de Supabase viaja en el cliente y
-- cualquiera puede leerla del bundle. RLS es la única frontera real. Sin estas
-- políticas, la base de datos está abierta al mundo.
--
-- Una sola política por tabla, para todas las operaciones:
--   using       → filtra lo que se puede leer, actualizar y borrar
--   with check  → valida lo que se inserta o se deja tras actualizar, e impide
--                 escribir filas a nombre de otro user_id
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'ejercicios','rutinas','rutina_dias','rutina_ejercicios','sesiones','series',
    'alimentos','recetas','receta_ingredientes','registros_comida',
    'objetivos_nutricionales','dias','medidas_corporales','fotos_progreso'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    -- Ni siquiera el dueño de la tabla se salta la política.
    execute format('alter table public.%I force row level security', t);

    execute format(
      'create policy %I on public.%I
         for all
         to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_solo_su_dueno', t
    );

    -- El rol anónimo no tiene nada que hacer aquí: no hay registro público.
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- ####################  0003_funciones.sql  ####################

-- =============================================================================
-- 0003 · Funciones
-- =============================================================================

-- "Qué hice la última vez en este ejercicio" es el dato que gobierna la
-- progresión y se pinta junto a cada ejercicio de la sesión. Resolverlo desde
-- el cliente son dos consultas por ejercicio; aquí es una sola llamada para
-- toda la rutina, que además se cachea entera antes de bajar al gimnasio.
--
-- p_excluir_sesion permite ignorar la sesión en curso: la última vez es la
-- anterior, no la que se está registrando ahora mismo.
create or replace function public.ultimas_series(
  p_ejercicio_ids  uuid[],
  p_excluir_sesion uuid default null
)
returns table (
  ejercicio_id  uuid,
  sesion_id     uuid,
  fecha         date,
  numero        int,
  peso_kg       numeric,
  reps          int,
  rir           int,
  tipo          text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ultima_sesion as (
    select distinct on (s.ejercicio_id)
      s.ejercicio_id,
      s.sesion_id,
      ses.fecha
    from public.series s
    join public.sesiones ses on ses.id = s.sesion_id
    where s.ejercicio_id = any(p_ejercicio_ids)
      and (p_excluir_sesion is null or s.sesion_id <> p_excluir_sesion)
    order by s.ejercicio_id, ses.fecha desc, ses.created_at desc
  )
  select
    u.ejercicio_id,
    u.sesion_id,
    u.fecha,
    s.numero,
    s.peso_kg,
    s.reps,
    s.rir,
    s.tipo
  from ultima_sesion u
  join public.series s
    on s.sesion_id = u.sesion_id
   and s.ejercicio_id = u.ejercicio_id
  order by u.ejercicio_id, s.numero;
$$;

revoke all on function public.ultimas_series(uuid[], uuid) from public, anon;
grant execute on function public.ultimas_series(uuid[], uuid) to authenticated;

-- ####################  0004_storage.sql  ####################

-- =============================================================================
-- 0004 · Storage para las fotos de progreso
--
-- Bucket privado. Las imágenes se muestran con URLs firmadas de caducidad
-- corta, nunca con enlaces públicos.
-- Convención de ruta: <user_id>/<uuid>.jpg — el primer segmento es lo que
-- comprueban las políticas.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  op text;
begin
  foreach op in array array['select','insert','update','delete'] loop
    execute format(
      'create policy %I on storage.objects
         for %s
         to authenticated
         %s (bucket_id = ''fotos''
             and (storage.foldername(name))[1] = (select auth.uid())::text)',
      'fotos_propias_' || op,
      op,
      -- insert solo admite with check; el resto usan using.
      case when op = 'insert' then 'with check' else 'using' end
    );
  end loop;
end;
$$;

-- ####################  0005_semilla_ejercicios.sql  ####################

-- =============================================================================
-- 0005 · Catálogo inicial de ejercicios
--
-- La app es de un solo usuario, así que el catálogo se siembra a nombre de la
-- cuenta ya creada a mano en el panel de Supabase. Nada de filas globales: así
-- la política de RLS sigue siendo una sola regla, y los ejercicios se pueden
-- renombrar y editar como cualquier otro dato propio.
--
-- Requiere que la cuenta exista. Si no, no inserta nada y avisa.
-- Es idempotente: se puede volver a ejecutar sin duplicar.
-- =============================================================================

do $$
declare
  v_user_id uuid;
  v_insertados int;
begin
  select id into v_user_id from auth.users order by created_at limit 1;

  if v_user_id is null then
    raise warning 'No hay ningún usuario en auth.users: catálogo no sembrado. Crea la cuenta y vuelve a ejecutar esta migración.';
    return;
  end if;

  insert into public.ejercicios (user_id, nombre, grupo_muscular, equipamiento, es_unilateral)
  select v_user_id, v.nombre, v.grupo, v.equipamiento, v.unilateral
  from (values
    -- Pecho
    ('Press de banca con barra',            'pecho',   'barra',         false),
    ('Press inclinado con barra',           'pecho',   'barra',         false),
    ('Press de banca con mancuernas',       'pecho',   'mancuerna',     false),
    ('Press inclinado con mancuernas',      'pecho',   'mancuerna',     false),
    ('Aperturas con mancuernas',            'pecho',   'mancuerna',     false),
    ('Cruces en polea',                     'pecho',   'polea',         false),
    ('Press de pecho en máquina',           'pecho',   'maquina',       false),
    ('Contractor de pecho',                 'pecho',   'maquina',       false),
    ('Fondos en paralelas',                 'pecho',   'peso_corporal', false),
    ('Flexiones',                           'pecho',   'peso_corporal', false),
    -- Espalda
    ('Dominadas',                           'espalda', 'peso_corporal', false),
    ('Dominadas supinas',                   'espalda', 'peso_corporal', false),
    ('Jalón al pecho',                      'espalda', 'polea',         false),
    ('Jalón agarre neutro',                 'espalda', 'polea',         false),
    ('Remo con barra',                      'espalda', 'barra',         false),
    ('Remo con mancuerna a una mano',       'espalda', 'mancuerna',     true),
    ('Remo en T',                           'espalda', 'barra',         false),
    ('Remo sentado en polea',               'espalda', 'polea',         false),
    ('Remo en máquina',                     'espalda', 'maquina',       false),
    ('Pull-over en polea',                  'espalda', 'polea',         false),
    ('Peso muerto convencional',            'espalda', 'barra',         false),
    ('Encogimientos de hombros',            'espalda', 'mancuerna',     false),
    ('Hiperextensiones',                    'espalda', 'peso_corporal', false),
    -- Pierna
    ('Sentadilla con barra',                'pierna',  'barra',         false),
    ('Sentadilla frontal',                  'pierna',  'barra',         false),
    ('Prensa de piernas',                   'pierna',  'maquina',       false),
    ('Hack squat',                          'pierna',  'maquina',       false),
    ('Zancadas con mancuernas',             'pierna',  'mancuerna',     true),
    ('Sentadilla búlgara',                  'pierna',  'mancuerna',     true),
    ('Extensión de cuádriceps',             'pierna',  'maquina',       false),
    ('Curl femoral tumbado',                'pierna',  'maquina',       false),
    ('Curl femoral sentado',                'pierna',  'maquina',       false),
    ('Peso muerto rumano',                  'pierna',  'barra',         false),
    ('Peso muerto sumo',                    'pierna',  'barra',         false),
    ('Hip thrust',                          'pierna',  'barra',         false),
    ('Buenos días',                         'pierna',  'barra',         false),
    ('Elevación de talones de pie',         'pierna',  'maquina',       false),
    ('Elevación de talones sentado',        'pierna',  'maquina',       false),
    ('Abducción de cadera en máquina',      'pierna',  'maquina',       false),
    ('Aducción de cadera en máquina',       'pierna',  'maquina',       false),
    -- Hombro
    ('Press militar con barra',             'hombro',  'barra',         false),
    ('Press militar con mancuernas',        'hombro',  'mancuerna',     false),
    ('Press Arnold',                        'hombro',  'mancuerna',     false),
    ('Elevaciones laterales',               'hombro',  'mancuerna',     false),
    ('Elevaciones laterales en polea',      'hombro',  'polea',         true),
    ('Elevaciones frontales',               'hombro',  'mancuerna',     false),
    ('Pájaros',                             'hombro',  'mancuerna',     false),
    ('Deltoides posterior en máquina',      'hombro',  'maquina',       false),
    ('Face pull',                           'hombro',  'polea',         false),
    ('Remo al mentón',                      'hombro',  'barra',         false),
    -- Bíceps
    ('Curl con barra',                      'biceps',  'barra',         false),
    ('Curl con barra Z',                    'biceps',  'barra',         false),
    ('Curl con mancuernas',                 'biceps',  'mancuerna',     false),
    ('Curl martillo',                       'biceps',  'mancuerna',     false),
    ('Curl inclinado',                      'biceps',  'mancuerna',     false),
    ('Curl concentrado',                    'biceps',  'mancuerna',     true),
    ('Curl en polea',                       'biceps',  'polea',         false),
    ('Curl predicador',                     'biceps',  'maquina',       false),
    -- Tríceps
    ('Press francés',                       'triceps', 'barra',         false),
    ('Press cerrado',                       'triceps', 'barra',         false),
    ('Extensión en polea con barra',        'triceps', 'polea',         false),
    ('Extensión en polea con cuerda',       'triceps', 'polea',         false),
    ('Extensión sobre la cabeza',           'triceps', 'mancuerna',     false),
    ('Patada de tríceps',                   'triceps', 'mancuerna',     true),
    ('Fondos en banco',                     'triceps', 'peso_corporal', false),
    -- Core
    ('Plancha',                             'core',    'peso_corporal', false),
    ('Elevaciones de piernas colgado',      'core',    'peso_corporal', false),
    ('Crunch en polea',                     'core',    'polea',         false),
    ('Rueda abdominal',                     'core',    'peso_corporal', false),
    ('Giro ruso',                           'core',    'mancuerna',     false)
  ) as v(nombre, grupo, equipamiento, unilateral)
  on conflict (user_id, lower(nombre)) do nothing;

  get diagnostics v_insertados = row_count;
  raise notice 'Ejercicios insertados: %', v_insertados;
end;
$$;

-- ####################  0006_ajustes.sql  ####################

-- =============================================================================
-- 0006 · Ajustes del usuario
--
-- Una sola fila por usuario para los ajustes que no son una lista de nada.
-- Nace con el peso objetivo, que hacía falta para la proyección de Progreso;
-- la tabla existe para que el siguiente ajuste suelto no pida otra migración.
--
-- Se sigue la convención del resto: el cliente manda el id, `user_id` tiene
-- default `auth.uid()`, y `updated_at` lo mantiene el trigger.
-- =============================================================================

create table public.ajustes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  -- La báscula de casa no da más de dos decimales.
  peso_objetivo  numeric(5,2),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Una fila por usuario: la app busca la que haya y reutiliza su id, igual que
-- hace con `dias` y `medidas_corporales`.
create unique index ajustes_por_usuario on public.ajustes (user_id);

create trigger ajustes_tocar_updated_at
  before update on public.ajustes
  for each row execute function public.tocar_updated_at();

-- Mismo cierre que las catorce anteriores: RLS activada y forzada, `anon`
-- revocado, y una sola política para todas las operaciones.
alter table public.ajustes enable row level security;
alter table public.ajustes force row level security;

revoke all on table public.ajustes from anon;
grant select, insert, update, delete on table public.ajustes to authenticated;

create policy ajustes_propios on public.ajustes
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ####################  0007_sembrar_catalogo.sql  ####################

-- =============================================================================
-- 0007 · Sembrar el catálogo para cualquier cuenta
--
-- La 0005 siembra los 70 ejercicios al PRIMER usuario de la base, que es lo que
-- hacía falta cuando la app era de una sola persona. Al añadir una segunda
-- cuenta, esa cuenta se encuentra el catálogo vacío.
--
-- Esto convierte la siembra en una función a la que se puede llamar por email,
-- tantas veces como haga falta. Es idempotente: el índice único por
-- (usuario, nombre) descarta lo que ya esté.
--
-- Se llama desde el SQL Editor, que corre como `postgres` y salta RLS. **No**
-- se concede a `authenticated`: sembrar es una acción de administración, y
-- dársela a la app dejaría que una cuenta escribiera filas a nombre de otra.
--
--   select public.sembrar_catalogo_ejercicios('pareja@ejemplo.com');
--
-- =============================================================================

create or replace function public.sembrar_catalogo_ejercicios(p_email text)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_insertados int;
begin
  select id into v_user_id from auth.users where lower(email) = lower(p_email);

  if v_user_id is null then
    raise exception 'No hay ninguna cuenta con el email %. Créala primero en Authentication → Users.', p_email;
  end if;

  insert into public.ejercicios (user_id, nombre, grupo_muscular, equipamiento, es_unilateral)
  select v_user_id, v.nombre, v.grupo, v.equipamiento, v.unilateral
  from (values
    -- Pecho
    ('Press de banca con barra',            'pecho',   'barra',         false),
    ('Press inclinado con barra',           'pecho',   'barra',         false),
    ('Press de banca con mancuernas',       'pecho',   'mancuerna',     false),
    ('Press inclinado con mancuernas',      'pecho',   'mancuerna',     false),
    ('Aperturas con mancuernas',            'pecho',   'mancuerna',     false),
    ('Cruces en polea',                     'pecho',   'polea',         false),
    ('Press de pecho en máquina',           'pecho',   'maquina',       false),
    ('Contractor de pecho',                 'pecho',   'maquina',       false),
    ('Fondos en paralelas',                 'pecho',   'peso_corporal', false),
    ('Flexiones',                           'pecho',   'peso_corporal', false),
    -- Espalda
    ('Dominadas',                           'espalda', 'peso_corporal', false),
    ('Dominadas supinas',                   'espalda', 'peso_corporal', false),
    ('Jalón al pecho',                      'espalda', 'polea',         false),
    ('Jalón agarre neutro',                 'espalda', 'polea',         false),
    ('Remo con barra',                      'espalda', 'barra',         false),
    ('Remo con mancuerna a una mano',       'espalda', 'mancuerna',     true),
    ('Remo en T',                           'espalda', 'barra',         false),
    ('Remo sentado en polea',               'espalda', 'polea',         false),
    ('Remo en máquina',                     'espalda', 'maquina',       false),
    ('Pull-over en polea',                  'espalda', 'polea',         false),
    ('Peso muerto convencional',            'espalda', 'barra',         false),
    ('Encogimientos de hombros',            'espalda', 'mancuerna',     false),
    ('Hiperextensiones',                    'espalda', 'peso_corporal', false),
    -- Pierna
    ('Sentadilla con barra',                'pierna',  'barra',         false),
    ('Sentadilla frontal',                  'pierna',  'barra',         false),
    ('Prensa de piernas',                   'pierna',  'maquina',       false),
    ('Hack squat',                          'pierna',  'maquina',       false),
    ('Zancadas con mancuernas',             'pierna',  'mancuerna',     true),
    ('Sentadilla búlgara',                  'pierna',  'mancuerna',     true),
    ('Extensión de cuádriceps',             'pierna',  'maquina',       false),
    ('Curl femoral tumbado',                'pierna',  'maquina',       false),
    ('Curl femoral sentado',                'pierna',  'maquina',       false),
    ('Peso muerto rumano',                  'pierna',  'barra',         false),
    ('Peso muerto sumo',                    'pierna',  'barra',         false),
    ('Hip thrust',                          'pierna',  'barra',         false),
    ('Buenos días',                         'pierna',  'barra',         false),
    ('Elevación de talones de pie',         'pierna',  'maquina',       false),
    ('Elevación de talones sentado',        'pierna',  'maquina',       false),
    ('Abducción de cadera en máquina',      'pierna',  'maquina',       false),
    ('Aducción de cadera en máquina',       'pierna',  'maquina',       false),
    -- Hombro
    ('Press militar con barra',             'hombro',  'barra',         false),
    ('Press militar con mancuernas',        'hombro',  'mancuerna',     false),
    ('Press Arnold',                        'hombro',  'mancuerna',     false),
    ('Elevaciones laterales',               'hombro',  'mancuerna',     false),
    ('Elevaciones laterales en polea',      'hombro',  'polea',         true),
    ('Elevaciones frontales',               'hombro',  'mancuerna',     false),
    ('Pájaros',                             'hombro',  'mancuerna',     false),
    ('Deltoides posterior en máquina',      'hombro',  'maquina',       false),
    ('Face pull',                           'hombro',  'polea',         false),
    ('Remo al mentón',                      'hombro',  'barra',         false),
    -- Bíceps
    ('Curl con barra',                      'biceps',  'barra',         false),
    ('Curl con barra Z',                    'biceps',  'barra',         false),
    ('Curl con mancuernas',                 'biceps',  'mancuerna',     false),
    ('Curl martillo',                       'biceps',  'mancuerna',     false),
    ('Curl inclinado',                      'biceps',  'mancuerna',     false),
    ('Curl concentrado',                    'biceps',  'mancuerna',     true),
    ('Curl en polea',                       'biceps',  'polea',         false),
    ('Curl predicador',                     'biceps',  'maquina',       false),
    -- Tríceps
    ('Press francés',                       'triceps', 'barra',         false),
    ('Press cerrado',                       'triceps', 'barra',         false),
    ('Extensión en polea con barra',        'triceps', 'polea',         false),
    ('Extensión en polea con cuerda',       'triceps', 'polea',         false),
    ('Extensión sobre la cabeza',           'triceps', 'mancuerna',     false),
    ('Patada de tríceps',                   'triceps', 'mancuerna',     true),
    ('Fondos en banco',                     'triceps', 'peso_corporal', false),
    -- Core
    ('Plancha',                             'core',    'peso_corporal', false),
    ('Elevaciones de piernas colgado',      'core',    'peso_corporal', false),
    ('Crunch en polea',                     'core',    'polea',         false),
    ('Rueda abdominal',                     'core',    'peso_corporal', false),
    ('Giro ruso',                           'core',    'mancuerna',     false)
  ) as v(nombre, grupo, equipamiento, unilateral)
  on conflict (user_id, lower(nombre)) do nothing;

  get diagnostics v_insertados = row_count;
  return v_insertados;
end;
$$;

revoke all on function public.sembrar_catalogo_ejercicios(text) from public, anon, authenticated;
