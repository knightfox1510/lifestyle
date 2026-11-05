-- Closing a day: when it was closed, what was skipped on purpose (so it isn't
-- counted as missed), and a one-line note for the day ("travelled"). The
-- note is personal like a check-in, so it's shared through the check-in share.
create table if not exists public.day_closes (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  day date not null,
  closed_at timestamptz,
  note text check (char_length(note) <= 280),
  skipped text[] not null default '{}' check (cardinality(skipped) <= 60),
  updated_at timestamptz not null default now(),
  primary key (owner_id, day)
);

alter table public.day_closes enable row level security;
drop policy if exists "day_closes: read" on public.day_closes;
create policy "day_closes: read" on public.day_closes for select to authenticated
  using (owner_id = auth.uid() or public.has_module_access(owner_id, 'checkin', 'read'));
drop policy if exists "day_closes: write own" on public.day_closes;
create policy "day_closes: write own" on public.day_closes for insert to authenticated
  with check (owner_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists "day_closes: update own" on public.day_closes;
create policy "day_closes: update own" on public.day_closes for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists "day_closes: delete own" on public.day_closes;
create policy "day_closes: delete own" on public.day_closes for delete to authenticated using (owner_id = auth.uid());
