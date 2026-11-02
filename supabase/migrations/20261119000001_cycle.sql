-- Cycle tracker: one row per person per day with period flow and symptoms.
-- Private by default (shared only through module_shares like other health data).

create table if not exists public.cycle_days (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  day date not null,
  flow text check (flow in ('spotting', 'light', 'medium', 'heavy')),
  symptoms text[] not null default '{}' check (symptoms <@ array[
    'cramps', 'bloating', 'headache', 'back_pain', 'breast_tenderness', 'fatigue', 'mood', 'acne', 'nausea', 'cravings', 'discharge', 'pelvic_pain'
  ]),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, day)
);
create index if not exists cycle_days_owner_idx on public.cycle_days (owner_id, day desc);

drop trigger if exists cycle_days_updated_at on public.cycle_days;
create trigger cycle_days_updated_at before update on public.cycle_days
  for each row execute function public.set_updated_at();

alter table public.cycle_days enable row level security;
drop policy if exists "cycle_days: read" on public.cycle_days;
create policy "cycle_days: read" on public.cycle_days for select to authenticated
  using (public.has_module_access(owner_id, 'cycle', 'read'));
drop policy if exists "cycle_days: insert" on public.cycle_days;
create policy "cycle_days: insert" on public.cycle_days for insert to authenticated
  with check (public.has_module_access(owner_id, 'cycle', 'write') and public.is_household_member(household_id));
drop policy if exists "cycle_days: update" on public.cycle_days;
create policy "cycle_days: update" on public.cycle_days for update to authenticated
  using (public.has_module_access(owner_id, 'cycle', 'write'))
  with check (public.has_module_access(owner_id, 'cycle', 'write') and public.is_household_member(household_id));
drop policy if exists "cycle_days: delete" on public.cycle_days;
create policy "cycle_days: delete" on public.cycle_days for delete to authenticated
  using (owner_id = auth.uid() or (created_by = auth.uid() and public.has_module_access(owner_id, 'cycle', 'write')));

-- Switch it on for existing households (new ones: Settings → Household).
insert into public.household_modules (household_id, module_key, enabled)
select h.id, 'cycle', true from public.households h
on conflict (household_id, module_key) do nothing;
