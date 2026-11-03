-- Water has its own share ("Water intake"), separate from the bladder diary:
-- someone can see (and, with "can edit", log) your water and other
-- non-alcoholic drinks without seeing your bladder diary. Alcohol stays
-- with the bladder diary share.
drop policy if exists "fluid_intake: read" on public.fluid_intake;
create policy "fluid_intake: read" on public.fluid_intake for select to authenticated
  using (
    public.has_module_access(owner_id, 'bladder_diary', 'read')
    or (drink <> 'alcohol' and public.has_module_access(owner_id, 'water', 'read'))
  );

drop policy if exists "fluid_intake: insert" on public.fluid_intake;
create policy "fluid_intake: insert" on public.fluid_intake for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and (
      public.has_module_access(owner_id, 'bladder_diary', 'write')
      or (drink = 'water' and public.has_module_access(owner_id, 'water', 'write'))
    )
  );

drop policy if exists "fluid_intake: update" on public.fluid_intake;
create policy "fluid_intake: update" on public.fluid_intake for update to authenticated
  using (
    public.has_module_access(owner_id, 'bladder_diary', 'write')
    or (drink = 'water' and public.has_module_access(owner_id, 'water', 'write'))
  )
  with check (
    public.is_household_member(household_id)
    and (
      public.has_module_access(owner_id, 'bladder_diary', 'write')
      or (drink = 'water' and public.has_module_access(owner_id, 'water', 'write'))
    )
  );

drop policy if exists "fluid_intake: creator delete" on public.fluid_intake;
create policy "fluid_intake: creator delete" on public.fluid_intake for delete to authenticated
  using (
    created_by = auth.uid()
    and (
      public.has_module_access(owner_id, 'bladder_diary', 'write')
      or (drink = 'water' and public.has_module_access(owner_id, 'water', 'write'))
    )
  );
