-- Hearth: update for an EXISTING database (set up before November 2026's redesign).
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once: anything already there is left as it is.
-- Adds: Home view choice, "close your day" and partner-update settings,
-- partner cheers, milestones, the streak calendar function and the AI model setting.
-- (New projects don't need this; all-in-one.sql already includes it.)

-- ---------------------------------------------------------------- profiles --
alter table public.profiles
  add column if not exists home_view text not null default 'arc';
do $$ begin
  alter table public.profiles add constraint profiles_home_view_check check (home_view in ('arc', 'bars', 'tiles'));
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------ notification prefs --
alter table public.notification_prefs
  add column if not exists close_day boolean not null default true,
  add column if not exists close_day_time time not null default '21:00',
  add column if not exists partner_updates boolean not null default true;

-- ------------------------------------------------------------------ cheers --
create table if not exists public.cheers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  from_user uuid not null default auth.uid() references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('👏', '❤️', '💪', '🎉')),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index if not exists cheers_to_idx on public.cheers (to_user, created_at desc);
create index if not exists cheers_from_idx on public.cheers (from_user, created_at desc);
alter table public.cheers enable row level security;
drop policy if exists "cheers: send to household members" on public.cheers;
create policy "cheers: send to household members" on public.cheers for insert to authenticated
  with check (from_user = auth.uid() and public.is_household_member(household_id) and public.shares_household(to_user)
    and exists (select 1 from public.household_members m where m.household_id = cheers.household_id and m.user_id = cheers.to_user));
drop policy if exists "cheers: sender or recipient reads" on public.cheers;
create policy "cheers: sender or recipient reads" on public.cheers for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- -------------------------------------------------------------- milestones --
create table if not exists public.milestones (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_.:-]{1,60}$'),
  achieved_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.milestones enable row level security;
drop policy if exists "milestones: own rows" on public.milestones;
create policy "milestones: own rows" on public.milestones for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------- streak calendar (dates) --
create or replace function public.activity_days(target uuid, since date)
returns setof date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
begin
  if auth.uid() is null or (target <> auth.uid() and not public.shares_household(target)) then
    return;
  end if;
  select coalesce(p.timezone, 'Asia/Kolkata') into tz from public.profiles p where p.id = target;
  return query
  select distinct d from (
    select (f.eaten_at at time zone tz)::date as d from public.food_entries f where f.owner_id = target and f.eaten_at >= since - 1
    union all select (w.occurred_at at time zone tz)::date from public.fluid_intake w where w.owner_id = target and w.occurred_at >= since - 1
    union all select (b.occurred_at at time zone tz)::date from public.bladder_events b where b.owner_id = target and b.occurred_at >= since - 1
    union all select md.scheduled_date from public.medicine_doses md where md.owner_id = target and md.status = 'taken' and md.scheduled_date >= since
    union all select c.checkin_date from public.daily_checkins c where c.owner_id = target and c.checkin_date >= since
    union all select (m.measured_at at time zone tz)::date from public.body_metrics m where m.owner_id = target and m.measured_at >= since - 1
    union all select s.log_date from public.supplement_logs s where s.owner_id = target and s.log_date >= since
    union all select (p.performed_at at time zone tz)::date from public.pelvic_floor_sessions p where p.owner_id = target and p.performed_at >= since - 1
  ) x
  where d >= since
  order by d;
end;
$$;
revoke all on function public.activity_days(uuid, date) from public, anon;
grant execute on function public.activity_days(uuid, date) to authenticated;

-- -------------------------------------------------------------- AI model --
alter table public.households
  add column if not exists ai_model text not null default 'standard';
do $$ begin
  alter table public.households add constraint households_ai_model_check check (ai_model in ('standard', 'best'));
exception when duplicate_object then null;
end $$;
