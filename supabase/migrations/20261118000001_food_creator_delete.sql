-- A logged food can be deleted by whoever logged it (e.g. a partner logging a
-- shared meal) while they have write access, not only by its owner.
drop policy if exists "food_entries: creator delete" on public.food_entries;
create policy "food_entries: creator delete" on public.food_entries for delete to authenticated
  using (created_by = auth.uid() and public.has_module_access(owner_id, 'food_diary', 'write'));
