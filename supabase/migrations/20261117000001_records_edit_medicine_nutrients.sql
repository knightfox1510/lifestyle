-- Timeline entries and lab results (e.g. read from papers) can be deleted by
-- whoever added them while they have write access, not only by their owner.
drop policy if exists "medical events: creator delete" on public.medical_events;
create policy "medical events: creator delete" on public.medical_events for delete to authenticated
  using (created_by = auth.uid() and public.has_module_access(owner_id, 'medical_records', 'write'));
drop policy if exists "lab_results: creator delete" on public.lab_results;
create policy "lab_results: creator delete" on public.lab_results for delete to authenticated
  using (created_by = auth.uid() and public.has_module_access(owner_id, 'medical_records', 'write'));

-- Medicines: active ingredients (composition) and vitamins/minerals per unit
-- (one tablet / capsule / ml), counted in the day's nutrients when a dose is taken.
alter table public.medicines
  add column if not exists ingredients text,
  add column if not exists nutrients jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.medicines add constraint medicines_ingredients_length check (char_length(ingredients) <= 400);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.medicines add constraint medicines_nutrients_object check (jsonb_typeof(nutrients) = 'object');
exception when duplicate_object then null;
end $$;
