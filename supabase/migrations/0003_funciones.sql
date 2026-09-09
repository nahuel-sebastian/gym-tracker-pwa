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
