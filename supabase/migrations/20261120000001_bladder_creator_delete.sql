-- Bladder diary entries and drinks can be deleted by whoever logged them
-- (e.g. a partner logging for someone) while they have write access.
drop policy if exists "bladder_events: creator delete" on public.bladder_events;
create policy "bladder_events: creator delete" on public.bladder_events for delete to authenticated
  using (created_by = auth.uid() and public.has_module_access(owner_id, 'bladder_diary', 'write'));
drop policy if exists "fluid_intake: creator delete" on public.fluid_intake;
create policy "fluid_intake: creator delete" on public.fluid_intake for delete to authenticated
  using (created_by = auth.uid() and public.has_module_access(owner_id, 'bladder_diary', 'write'));
