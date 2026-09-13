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
