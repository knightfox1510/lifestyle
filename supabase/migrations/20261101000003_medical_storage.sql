-- Private Storage bucket for hospital papers / reports.
-- Object paths are "<owner_id>/<uuid>.<ext>", so the first folder is the owner.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-documents',
  'medical-documents',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "medical files: read with module access" on storage.objects
  for select to authenticated using (
    bucket_id = 'medical-documents'
    and public.has_module_access(((storage.foldername(name))[1])::uuid, 'medical_records', 'read')
  );

create policy "medical files: upload with write access" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'medical-documents'
    and public.has_module_access(((storage.foldername(name))[1])::uuid, 'medical_records', 'write')
  );

create policy "medical files: owner delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
