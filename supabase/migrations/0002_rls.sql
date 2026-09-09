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
