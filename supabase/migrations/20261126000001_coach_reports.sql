-- AI coach: saved reports (insights + plan) so progress can be compared over
-- time. A report can mention medical details, so it's visible only to the
-- person it's about and to whoever ran it, not to everyone with Body access.
create table if not exists public.coach_reports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  goal text not null check (char_length(goal) <= 40),
  question text check (char_length(question) <= 600),
  period_days integer not null check (period_days between 7 and 180),
  included text[] not null default '{}',
  facts jsonb not null default '{}'::jsonb,
  result jsonb not null,
  applied_at timestamptz
);
create index if not exists coach_reports_owner_idx on public.coach_reports (owner_id, created_at desc);

alter table public.coach_reports enable row level security;
drop policy if exists "coach_reports: read" on public.coach_reports;
create policy "coach_reports: read" on public.coach_reports for select to authenticated
  using (owner_id = auth.uid() or created_by = auth.uid());
drop policy if exists "coach_reports: insert" on public.coach_reports;
create policy "coach_reports: insert" on public.coach_reports for insert to authenticated
  with check (created_by = auth.uid() and public.is_household_member(household_id) and public.has_module_access(owner_id, 'body_recomp', 'read'));
drop policy if exists "coach_reports: update" on public.coach_reports;
create policy "coach_reports: update" on public.coach_reports for update to authenticated
  using (owner_id = auth.uid() or created_by = auth.uid())
  with check (public.is_household_member(household_id));
drop policy if exists "coach_reports: delete" on public.coach_reports;
create policy "coach_reports: delete" on public.coach_reports for delete to authenticated
  using (owner_id = auth.uid() or created_by = auth.uid());
