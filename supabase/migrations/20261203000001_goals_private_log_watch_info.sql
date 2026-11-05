-- Weekly fitness goals ("gym 4 times a week, walk 3 times"), a private log
-- (alcohol, intimacy, solo sex, smoking…) and looked-up details for the
-- watchlist (year, IMDb rating, genres, where to stream).

-- ------------------------------------------------------- fitness goals --
create table if not exists public.fitness_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  -- A workout type, or 'any' for "any workout N times a week".
  kind text not null check (kind in ('any', 'gym', 'yoga', 'pilates', 'swim', 'run', 'walk', 'cycle', 'dance', 'sport', 'class', 'physio', 'other')),
  times_per_week smallint not null check (times_per_week between 1 and 14),
  -- Only sessions at least this long count (null: any length).
  min_minutes smallint check (min_minutes between 1 and 600),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, kind)
);

alter table public.fitness_goals enable row level security;
drop policy if exists "fitness_goals: read" on public.fitness_goals;
create policy "fitness_goals: read" on public.fitness_goals for select to authenticated
  using (public.has_module_access(owner_id, 'fitness', 'read'));
drop policy if exists "fitness_goals: insert" on public.fitness_goals;
create policy "fitness_goals: insert" on public.fitness_goals for insert to authenticated
  with check (public.has_module_access(owner_id, 'fitness', 'write') and public.is_household_member(household_id));
drop policy if exists "fitness_goals: update" on public.fitness_goals;
create policy "fitness_goals: update" on public.fitness_goals for update to authenticated
  using (public.has_module_access(owner_id, 'fitness', 'write'))
  with check (public.has_module_access(owner_id, 'fitness', 'write') and public.is_household_member(household_id));
drop policy if exists "fitness_goals: owner delete" on public.fitness_goals;
create policy "fitness_goals: owner delete" on public.fitness_goals for delete to authenticated
  using (owner_id = auth.uid());

-- --------------------------------------------------------- private log --
-- Only the owner writes; a partner sees it only if it's shared with them
-- (Settings → Sharing). Never sent to AI unless the owner turns that on.
create table if not exists public.private_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  kind text not null check (kind in ('alcohol', 'intimacy', 'solo', 'smoking', 'cannabis', 'other')),
  -- What exactly: 'beer', 'wine', 'spirits' / 'cuddle', 'kiss', 'sex' / free text for 'other'.
  detail text check (char_length(detail) <= 40),
  -- Standard drinks, cigarettes… (null when a count doesn't apply).
  amount numeric(5, 1) check (amount > 0 and amount <= 100),
  occurred_on date not null,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists private_logs_owner_idx on public.private_logs (owner_id, occurred_on desc);

alter table public.private_logs enable row level security;
drop policy if exists "private_logs: read" on public.private_logs;
create policy "private_logs: read" on public.private_logs for select to authenticated
  using (public.has_module_access(owner_id, 'private_log', 'read'));
drop policy if exists "private_logs: insert" on public.private_logs;
create policy "private_logs: insert" on public.private_logs for insert to authenticated
  with check (owner_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists "private_logs: update" on public.private_logs;
create policy "private_logs: update" on public.private_logs for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists "private_logs: delete" on public.private_logs;
create policy "private_logs: delete" on public.private_logs for delete to authenticated
  using (owner_id = auth.uid());

-- Whether the AI coach may count drinks (only drinks; the rest never goes to AI).
alter table public.profiles add column if not exists ai_include_alcohol boolean not null default false;

-- Switch it on for existing households; each person can hide it in Settings → My features.
insert into public.household_modules (household_id, module_key, enabled)
select h.id, 'private_log', true from public.households h
on conflict (household_id, module_key) do nothing;

-- ---------------------------------------------------- watchlist details --
alter table public.watchlist_items add column if not exists year smallint check (year between 1880 and 2100);
alter table public.watchlist_items add column if not exists imdb_rating numeric(3, 1) check (imdb_rating between 0 and 10);
alter table public.watchlist_items add column if not exists genres text[] not null default '{}' check (cardinality(genres) <= 8);
alter table public.watchlist_items add column if not exists overview text check (char_length(overview) <= 600);
alter table public.watchlist_items add column if not exists runtime_minutes smallint check (runtime_minutes between 1 and 1000);
alter table public.watchlist_items add column if not exists total_episodes smallint check (total_episodes between 1 and 5000);
alter table public.watchlist_items add column if not exists info_checked_at timestamptz;
