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
