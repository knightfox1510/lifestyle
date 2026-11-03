-- Hearth: update for an EXISTING database (set up before November 2026's redesign).
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once: anything already there is left as it is.
-- Adds: Home view choice, "close your day" and partner-update settings,
-- partner cheers, milestones, the streak calendar function, the AI model setting
-- the "Other / misc" meal, re-joining a household with the same invite,
-- supplement nutrients and pantry running-low / staples.
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

-- --------------------------------------------------- "Other / misc" meal --
alter table public.food_entries drop constraint if exists food_entries_meal_check;
alter table public.food_entries add constraint food_entries_meal_check check (meal in ('breakfast', 'lunch', 'dinner', 'snack', 'other'));
alter table public.meal_plan drop constraint if exists meal_plan_meal_check;
alter table public.meal_plan add constraint meal_plan_meal_check check (meal in ('breakfast', 'lunch', 'dinner', 'snack', 'other'));

-- --------------------------------------- re-joining with the same invite --
create or replace function public.accept_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from public.invites
  where code = upper(trim(invite_code))
  for update;

  if not found then
    raise exception 'invite not found';
  end if;

  -- Already accepted by this person, or already a member: just make it active.
  if inv.accepted_by = auth.uid()
     or exists (select 1 from public.household_members m where m.household_id = inv.household_id and m.user_id = auth.uid()) then
    insert into public.household_members (household_id, user_id, role)
    values (inv.household_id, auth.uid(), 'member')
    on conflict do nothing;
    update public.profiles set active_household_id = inv.household_id where id = auth.uid();
    return inv.household_id;
  end if;

  if inv.accepted_at is not null then
    raise exception 'invite already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'invite expired';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, auth.uid(), 'member')
  on conflict do nothing;

  update public.invites
  set accepted_by = auth.uid(), accepted_at = now()
  where id = inv.id;

  update public.profiles set active_household_id = inv.household_id where id = auth.uid();
  return inv.household_id;
end;
$$;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- ---------------- supplement nutrients, pantry running low / staples --
alter table public.supplements
  add column if not exists nutrients jsonb not null default '{}'::jsonb,
  add column if not exists serving_label text,
  add column if not exists nutrients_source text;
do $$ begin
  alter table public.supplements add constraint supplements_nutrients_object check (jsonb_typeof(nutrients) = 'object');
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.supplements add constraint supplements_serving_label_len check (char_length(serving_label) <= 40);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.supplements add constraint supplements_nutrients_source_check check (nutrients_source in ('manual', 'label', 'catalog'));
exception when duplicate_object then null;
end $$;

alter table public.pantry_items
  add column if not exists staple boolean not null default false,
  add column if not exists running_low boolean not null default false;

alter table public.grocery_items
  add column if not exists reason text,
  add column if not exists pantry_item_id uuid references public.pantry_items (id) on delete set null;
do $$ begin
  alter table public.grocery_items add constraint grocery_items_reason_check check (reason in ('used_up', 'running_low', 'staple'));
exception when duplicate_object then null;
end $$;

-- A grocery item can only point at a pantry item of the same household.
create or replace function public.grocery_pantry_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pantry_item_id is not null and not exists (
    select 1 from public.pantry_items p where p.id = new.pantry_item_id and p.household_id = new.household_id
  ) then
    raise exception 'pantry item not found in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists grocery_items_pantry_check on public.grocery_items;
create trigger grocery_items_pantry_check before insert or update on public.grocery_items
  for each row execute function public.grocery_pantry_check();

-- --------------------------------------- weekly meal plan: shopping day --
-- Weekly meal planning: the household's grocery-shopping day (0 = Sunday …
-- 6 = Saturday). The plan week starts on it. Any member may change it.

alter table public.households
  add column if not exists shopping_day smallint not null default 0;
do $$ begin
  alter table public.households add constraint households_shopping_day_check check (shopping_day between 0 and 6);
exception when duplicate_object then null;
end $$;

create or replace function public.set_shopping_day(p_household uuid, p_day smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_member(p_household) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;
  if p_day is null or p_day < 0 or p_day > 6 then
    raise exception 'shopping day must be 0-6' using errcode = '22023';
  end if;
  update public.households set shopping_day = p_day where id = p_household;
end;
$$;
revoke all on function public.set_shopping_day(uuid, smallint) from public;
grant execute on function public.set_shopping_day(uuid, smallint) to authenticated;

-- ------------------------------ medicines: whoever added one can delete it --
-- A medicine added by mistake can be deleted by whoever added it (e.g. a
-- partner managing someone's medicines with write access), not only its owner.
drop policy if exists "medicines: creator delete" on public.medicines;
create policy "medicines: creator delete" on public.medicines for delete to authenticated
  using (created_by = auth.uid() and public.has_module_access(owner_id, 'medicines', 'write'));

-- ------------- edit/delete imported records; medicine composition + nutrients --
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

-- ------------------------------ food entries: whoever logged one can delete it --
-- A logged food can be deleted by whoever logged it (e.g. a partner logging a
-- shared meal) while they have write access, not only by its owner.
drop policy if exists "food_entries: creator delete" on public.food_entries;
create policy "food_entries: creator delete" on public.food_entries for delete to authenticated
  using (created_by = auth.uid() and public.has_module_access(owner_id, 'food_diary', 'write'));

-- -------------------------------------------------------------- cycle tracker --
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

-- ---------------------- bladder diary: whoever logged an entry can delete it --
-- Bladder diary entries and drinks can be deleted by whoever logged them
-- (e.g. a partner logging for someone) while they have write access.
drop policy if exists "bladder_events: creator delete" on public.bladder_events;
create policy "bladder_events: creator delete" on public.bladder_events for delete to authenticated
  using (created_by = auth.uid() and public.has_module_access(owner_id, 'bladder_diary', 'write'));
drop policy if exists "fluid_intake: creator delete" on public.fluid_intake;
create policy "fluid_intake: creator delete" on public.fluid_intake for delete to authenticated
  using (created_by = auth.uid() and public.has_module_access(owner_id, 'bladder_diary', 'write'));

-- ------------------------------ week plan: per-person portions, macros, ingredients --
-- Week plan per person: a dish can be for one member only, each person has
-- their own portion, dishes carry per-serving macros and an ingredient list
-- (for the grocery list), and we remember when a planned meal was logged.
alter table public.meal_plan
  add column if not exists for_user uuid references auth.users (id) on delete cascade,
  add column if not exists portions jsonb not null default '{}'::jsonb,
  add column if not exists kcal_per_serving integer,
  add column if not exists protein_g numeric(6, 1),
  add column if not exists carbs_g numeric(6, 1),
  add column if not exists fat_g numeric(6, 1),
  add column if not exists ingredients jsonb not null default '[]'::jsonb,
  add column if not exists logged_at timestamptz;
do $$ begin
  alter table public.meal_plan add constraint meal_plan_portions_object check (jsonb_typeof(portions) = 'object');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.meal_plan add constraint meal_plan_ingredients_array check (jsonb_typeof(ingredients) = 'array');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.meal_plan add constraint meal_plan_kcal_range check (kcal_per_serving between 0 and 5000);
exception when duplicate_object then null; end $$;

-- A dish "just for" someone must be for a member of the same household.
create or replace function public.meal_plan_member_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.for_user is not null and not exists (
    select 1 from public.household_members m where m.household_id = new.household_id and m.user_id = new.for_user
  ) then
    raise exception 'that person is not in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists meal_plan_member_check on public.meal_plan;
create trigger meal_plan_member_check before insert or update on public.meal_plan
  for each row execute function public.meal_plan_member_check();

-- -------------------------------------- features switched off per person --
-- Features each person has switched off for themselves (e.g. Gaurav hides the
-- cycle tracker). The household setting still decides what exists at all.
alter table public.profiles
  add column if not exists hidden_modules text[] not null default '{}';
do $$ begin
  alter table public.profiles add constraint profiles_hidden_modules_check check (cardinality(hidden_modules) <= 60);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------- remembered food matches --
-- Remembered food matches: when you log an ingredient with a match you've
-- seen (or fixed), the same name uses the same food data next time, so
-- "pink guava" is always the same 68 kcal/100 g and never re-guessed.
create table if not exists public.food_aliases (
  household_id uuid not null references public.households (id) on delete cascade,
  name_key text not null check (char_length(name_key) between 1 and 80),
  label text not null check (char_length(label) between 1 and 200),
  ref jsonb not null check (jsonb_typeof(ref) = 'object'),
  per100 jsonb not null check (jsonb_typeof(per100) = 'object'),
  source text check (char_length(source) <= 40),
  confirmed boolean not null default false,
  uses integer not null default 1,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (household_id, name_key)
);

alter table public.food_aliases enable row level security;
drop policy if exists "food_aliases: members read" on public.food_aliases;
create policy "food_aliases: members read" on public.food_aliases for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "food_aliases: members insert" on public.food_aliases;
create policy "food_aliases: members insert" on public.food_aliases for insert to authenticated with check (public.is_household_member(household_id));
drop policy if exists "food_aliases: members update" on public.food_aliases;
create policy "food_aliases: members update" on public.food_aliases for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists "food_aliases: members delete" on public.food_aliases;
create policy "food_aliases: members delete" on public.food_aliases for delete to authenticated using (public.is_household_member(household_id));

-- ----------------------------- how often (medicines, supplements); supplement times --
-- How often: medicines and supplements can repeat every N days (weekly =
-- one weekday, fortnightly = every 14 days, monthly D3 60K = every 30 days…),
-- supplements can also be on chosen weekdays. Each person can set the clock
-- time for supplement timings (morning, with a meal, bedtime…).
alter table public.medicines
  add column if not exists repeat_every_days smallint;
do $$ begin
  alter table public.medicines add constraint medicines_repeat_every_days_check check (repeat_every_days between 2 and 365);
exception when duplicate_object then null; end $$;

alter table public.supplements
  add column if not exists days_of_week smallint[],
  add column if not exists repeat_every_days smallint,
  add column if not exists schedule_start date;
update public.supplements set schedule_start = (created_at at time zone 'Asia/Kolkata')::date where schedule_start is null;
alter table public.supplements alter column schedule_start set default current_date;
do $$ begin
  alter table public.supplements add constraint supplements_repeat_every_days_check check (repeat_every_days between 2 and 365);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.supplements add constraint supplements_days_of_week_check check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(days_of_week) between 1 and 7);
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists supplement_times jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.profiles add constraint profiles_supplement_times_object check (jsonb_typeof(supplement_times) = 'object');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------- Health Connect daily sync --
-- Health Connect daily sync: a private bucket the sync script uploads the
-- export zip to (through a signed upload URL from the app; the app deletes
-- the file once it's read), and each person's last sync result.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('health-imports', 'health-imports', false, 52428800, array['application/zip', 'application/x-zip-compressed', 'application/octet-stream'])
on conflict (id) do nothing;

create table if not exists public.health_connect_syncs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_file text check (char_length(last_file) <= 300),
  last_file_modified timestamptz,
  last_run_at timestamptz,
  last_status text check (last_status in ('ok', 'error', 'skipped')),
  last_message text check (char_length(last_message) <= 500),
  last_day date,
  days_imported integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.health_connect_syncs enable row level security;
drop policy if exists "health_connect_syncs: read own" on public.health_connect_syncs;
create policy "health_connect_syncs: read own" on public.health_connect_syncs for select to authenticated using (user_id = auth.uid());

-- Days imported from Health Connect are marked as such.
alter table public.wearable_daily drop constraint if exists wearable_daily_source_check;
alter table public.wearable_daily add constraint wearable_daily_source_check check (source in ('manual', 'csv', 'webhook', 'health_connect'));

-- ---- 20261126000001_coach_reports.sql ----
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

-- ---- 20261127000001_water_sharing.sql ----
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
