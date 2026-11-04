-- Meal photos: a small copy of the photo a meal was logged from, shown next
-- to the entry and on Today. Paths are "<uploader id>/<uuid>.jpg"; members of
-- the uploader's household can view them (the entry itself stays private).
alter table public.food_entries add column if not exists photo_path text check (char_length(photo_path) <= 200);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-photos', 'food-photos', false, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "food photos: household read" on storage.objects;
create policy "food photos: household read" on storage.objects for select to authenticated using (
  bucket_id = 'food-photos'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.shares_household(((storage.foldername(name))[1])::uuid))
);
drop policy if exists "food photos: upload your own" on storage.objects;
create policy "food photos: upload your own" on storage.objects for insert to authenticated with check (
  bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "food photos: delete your own" on storage.objects;
create policy "food photos: delete your own" on storage.objects for delete to authenticated using (
  bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
