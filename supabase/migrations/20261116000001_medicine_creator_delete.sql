-- A medicine added by mistake can be deleted by whoever added it (e.g. a
-- partner managing someone's medicines with write access), not only its owner.
drop policy if exists "medicines: creator delete" on public.medicines;
create policy "medicines: creator delete" on public.medicines for delete to authenticated
  using (created_by = auth.uid() and public.has_module_access(owner_id, 'medicines', 'write'));
