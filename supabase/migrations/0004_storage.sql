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
