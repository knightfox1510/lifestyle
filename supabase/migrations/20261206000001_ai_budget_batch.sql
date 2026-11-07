-- More AI savings: a monthly budget and a daily web-search limit per
-- household, Google's half-price batch mode for work nobody is waiting on,
-- a weekly summary that's built without AI unless chosen, and imported
-- workouts that stay deleted.

-- Household AI limits (null = no cap). The warned month stops the 80% warning repeating.
alter table public.households add column if not exists ai_monthly_budget_inr integer check (ai_monthly_budget_inr between 10 and 1000000);
alter table public.households add column if not exists ai_search_daily_limit smallint check (ai_search_daily_limit between 0 and 500);
alter table public.households add column if not exists ai_budget_warned_month text check (ai_budget_warned_month ~ '^\d{4}-\d{2}$');

-- Sent in batch mode (half price).
alter table public.ai_usage add column if not exists batch boolean not null default false;

-- Weekly summary written by AI instead of from the week's numbers.
alter table public.notification_prefs add column if not exists digest_ai boolean not null default false;

-- Batch jobs waiting at Google: submitted on one reminder run, collected on a later one.
create table if not exists public.ai_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (char_length(feature) <= 60),
  job_name text not null check (char_length(job_name) <= 200),
  model text check (char_length(model) <= 80),
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ai_batches_pending_idx on public.ai_batches (user_id) where status = 'pending';
alter table public.ai_batches enable row level security;
-- Written by the server (service role); you can see your own.
drop policy if exists "ai_batches: read own" on public.ai_batches;
create policy "ai_batches: read own" on public.ai_batches for select to authenticated using (user_id = auth.uid());

-- Health Connect workouts the person deleted, so a re-sync doesn't bring them back.
create table if not exists public.workout_dismissed (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  external_id text not null check (char_length(external_id) <= 80),
  created_at timestamptz not null default now(),
  primary key (owner_id, external_id)
);
alter table public.workout_dismissed enable row level security;
drop policy if exists "workout_dismissed: own" on public.workout_dismissed;
create policy "workout_dismissed: own" on public.workout_dismissed for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
