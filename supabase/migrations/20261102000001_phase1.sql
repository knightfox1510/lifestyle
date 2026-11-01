-- Phase 1: medicines, supplements, bladder diary (+ fluids), pelvic floor
-- trainer, daily check-in, habits and the household grocery list.
--
-- Personal tables carry owner_id + household_id and use the same sharing model
-- as medical records (has_module_access). Log tables (doses, ticks) carry
-- owner_id too so their policies stay a single function call.

-- ---------------------------------------------------------------- medicines --
create or replace function public.valid_clock_times(arr text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(t ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), true)
    and coalesce(array_length(arr, 1), 0) <= 8
  from unnest(arr) as t;
$$;

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  strength text check (char_length(strength) <= 60),
  form text not null default 'tablet' check (form in ('tablet', 'capsule', 'syrup', 'injection', 'drops', 'inhaler', 'cream', 'other')),
  dose_amount numeric(6, 2) not null default 1 check (dose_amount > 0),
  dose_unit text not null default 'tablet' check (char_length(dose_unit) <= 20),
  instructions text check (char_length(instructions) <= 300),
  -- Daily schedule as local "HH:MM" times; empty = take as needed.
  times text[] not null default '{}' check (public.valid_clock_times(times)),
  -- 0 = Sunday … 6 = Saturday; null = every day.
  days_of_week smallint[] check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  start_date date not null default current_date,
  end_date date,
  stock_count numeric(8, 2) check (stock_count >= 0),
  refill_threshold numeric(8, 2) check (refill_threshold >= 0),
  reason text check (char_length(reason) <= 200),
  prescribed_by text check (char_length(prescribed_by) <= 120),
  active boolean not null default true,
  include_in_ai boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index medicines_owner_idx on public.medicines (owner_id, active);
create trigger medicines_updated_at before update on public.medicines
  for each row execute function public.set_updated_at();

create table public.medicine_doses (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  scheduled_date date not null,
  -- "HH:MM" for scheduled doses, null for as-needed doses.
  scheduled_time text check (scheduled_time ~ '^\d{2}:\d{2}$'),
  status text not null check (status in ('taken', 'skipped')),
  taken_at timestamptz not null default now(),
  logged_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index medicine_doses_slot_idx on public.medicine_doses (medicine_id, scheduled_date, scheduled_time)
  where scheduled_time is not null;
create index medicine_doses_owner_idx on public.medicine_doses (owner_id, scheduled_date desc);

-- Keep stock in step with doses taken (and give it back if a dose is undone).
create or replace function public.medicine_dose_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta numeric := 0;
  med uuid;
begin
  if tg_op = 'INSERT' then
    med := new.medicine_id;
    if new.status = 'taken' then delta := -1; end if;
  elsif tg_op = 'DELETE' then
    med := old.medicine_id;
    if old.status = 'taken' then delta := 1; end if;
  else
    med := new.medicine_id;
    if old.status = 'taken' and new.status <> 'taken' then delta := 1; end if;
    if old.status <> 'taken' and new.status = 'taken' then delta := -1; end if;
  end if;

  if delta <> 0 then
    update public.medicines m
    set stock_count = greatest(0, m.stock_count + delta * m.dose_amount)
    where m.id = med and m.stock_count is not null;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger medicine_doses_stock after insert or update or delete on public.medicine_doses
  for each row execute function public.medicine_dose_stock();

-- -------------------------------------------------------------- supplements --
create table public.supplements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  dose text check (char_length(dose) <= 60),
  timing text not null default 'morning' check (timing in ('morning', 'afternoon', 'evening', 'bedtime', 'with_meal', 'post_workout')),
  sort integer not null default 0,
  stock_count integer check (stock_count >= 0),
  active boolean not null default true,
  include_in_ai boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index supplements_owner_idx on public.supplements (owner_id, active, sort);
create trigger supplements_updated_at before update on public.supplements
  for each row execute function public.set_updated_at();

-- One row per supplement per day = ticked. The checklist "resets" because a
-- new day has no rows yet; history stays intact.
create table public.supplement_logs (
  supplement_id uuid not null references public.supplements (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  taken_at timestamptz not null default now(),
  primary key (supplement_id, log_date)
);
create index supplement_logs_owner_idx on public.supplement_logs (owner_id, log_date desc);

-- ------------------------------------------------------------ bladder diary --
create table public.bladder_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  kind text not null check (kind in ('leak', 'urge', 'void')),
  amount text check (amount in ('drops', 'small', 'medium', 'large')),
  urgency smallint check (urgency between 1 and 5),
  triggers text[] not null default '{}' check (triggers <@ array[
    'cough', 'sneeze', 'laugh', 'lifting', 'exercise', 'yoga', 'running', 'jumping',
    'standing_up', 'bending', 'urgency', 'during_sleep', 'cold', 'stress', 'other'
  ]),
  pad_changed boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);
create index bladder_events_owner_idx on public.bladder_events (owner_id, occurred_at desc);

create table public.fluid_intake (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  drink text not null check (drink in ('water', 'tea', 'coffee', 'milk', 'juice', 'soda', 'alcohol', 'electrolyte', 'other')),
  volume_ml integer not null check (volume_ml between 10 and 3000),
  caffeinated boolean not null default false,
  created_at timestamptz not null default now()
);
create index fluid_intake_owner_idx on public.fluid_intake (owner_id, occurred_at desc);

-- ----------------------------------------------------- pelvic floor trainer --
create table public.pelvic_floor_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  performed_at timestamptz not null default now(),
  sets smallint not null check (sets between 1 and 10),
  reps smallint not null check (reps between 1 and 50),
  hold_seconds smallint not null check (hold_seconds between 1 and 60),
  relax_seconds smallint not null check (relax_seconds between 1 and 60),
  quick_flicks smallint not null default 0 check (quick_flicks between 0 and 50),
  completed boolean not null default true,
  duration_seconds integer not null check (duration_seconds between 0 and 7200),
  created_at timestamptz not null default now()
);
create index pelvic_floor_owner_idx on public.pelvic_floor_sessions (owner_id, performed_at desc);

-- ---------------------------------------------------------- daily check-in --
create table public.daily_checkins (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  checkin_date date not null,
  sleep_hours numeric(3, 1) check (sleep_hours between 0 and 24),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  stress smallint check (stress between 1 and 5),
  notes text check (char_length(notes) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, checkin_date)
);
create trigger daily_checkins_updated_at before update on public.daily_checkins
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- habits --
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  icon text not null default '✅' check (char_length(icon) <= 8),
  target_per_week smallint not null default 7 check (target_per_week between 1 and 7),
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index habits_owner_idx on public.habits (owner_id, active, sort);

create table public.habit_logs (
  habit_id uuid not null references public.habits (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, log_date)
);
create index habit_logs_owner_idx on public.habit_logs (owner_id, log_date desc);

-- -------------------------------------------------- grocery list (shared) --
-- Household-scoped. Rows are created with client-generated ids so offline
-- edits replay idempotently; deletes are soft (deleted_at) so they sync too.
create table public.grocery_items (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  quantity text check (char_length(quantity) <= 40),
  category text not null default 'other' check (category in (
    'produce', 'dairy', 'meat', 'bakery', 'pantry', 'frozen', 'beverages', 'snacks', 'household', 'personal_care', 'baby', 'other'
  )),
  notes text check (char_length(notes) <= 300),
  checked boolean not null default false,
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index grocery_items_household_idx on public.grocery_items (household_id, updated_at desc);
create trigger grocery_items_updated_at before update on public.grocery_items
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- RLS --
alter table public.medicines enable row level security;
alter table public.medicine_doses enable row level security;
alter table public.supplements enable row level security;
alter table public.supplement_logs enable row level security;
alter table public.bladder_events enable row level security;
alter table public.fluid_intake enable row level security;
alter table public.pelvic_floor_sessions enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.grocery_items enable row level security;

-- Personal "entity" tables: read with a read grant, write with a write grant,
-- insert only into a household you belong to, delete by the owner only.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('medicines', 'medicines'),
      ('supplements', 'supplements'),
      ('bladder_events', 'bladder_diary'),
      ('fluid_intake', 'bladder_diary'),
      ('pelvic_floor_sessions', 'pelvic_floor'),
      ('daily_checkins', 'checkin'),
      ('habits', 'habits')
    ) as v(tbl, module)
  loop
    execute format(
      'create policy "%1$s: read" on public.%1$I for select to authenticated using (public.has_module_access(owner_id, %2$L, ''read''))',
      t.tbl, t.module);
    execute format(
      'create policy "%1$s: insert" on public.%1$I for insert to authenticated with check (public.has_module_access(owner_id, %2$L, ''write'') and public.is_household_member(household_id))',
      t.tbl, t.module);
    execute format(
      'create policy "%1$s: update" on public.%1$I for update to authenticated using (public.has_module_access(owner_id, %2$L, ''write'')) with check (public.has_module_access(owner_id, %2$L, ''write'') and public.is_household_member(household_id))',
      t.tbl, t.module);
    execute format(
      'create policy "%1$s: owner delete" on public.%1$I for delete to authenticated using (owner_id = auth.uid())',
      t.tbl, t.module);
  end loop;
end $$;

-- Log tables: anyone with write access may tick/untick, and the log's owner
-- must match its parent's owner.
create policy "medicine_doses: read" on public.medicine_doses for select to authenticated
  using (public.has_module_access(owner_id, 'medicines', 'read'));
create policy "medicine_doses: insert" on public.medicine_doses for insert to authenticated
  with check (
    logged_by = auth.uid()
    and public.has_module_access(owner_id, 'medicines', 'write')
    and exists (select 1 from public.medicines m where m.id = medicine_id and m.owner_id = medicine_doses.owner_id)
  );
create policy "medicine_doses: update" on public.medicine_doses for update to authenticated
  using (public.has_module_access(owner_id, 'medicines', 'write'))
  with check (public.has_module_access(owner_id, 'medicines', 'write'));
create policy "medicine_doses: delete" on public.medicine_doses for delete to authenticated
  using (public.has_module_access(owner_id, 'medicines', 'write'));

create policy "supplement_logs: read" on public.supplement_logs for select to authenticated
  using (public.has_module_access(owner_id, 'supplements', 'read'));
create policy "supplement_logs: insert" on public.supplement_logs for insert to authenticated
  with check (
    public.has_module_access(owner_id, 'supplements', 'write')
    and exists (select 1 from public.supplements s where s.id = supplement_id and s.owner_id = supplement_logs.owner_id)
  );
create policy "supplement_logs: delete" on public.supplement_logs for delete to authenticated
  using (public.has_module_access(owner_id, 'supplements', 'write'));

create policy "habit_logs: read" on public.habit_logs for select to authenticated
  using (public.has_module_access(owner_id, 'habits', 'read'));
create policy "habit_logs: insert" on public.habit_logs for insert to authenticated
  with check (
    public.has_module_access(owner_id, 'habits', 'write')
    and exists (select 1 from public.habits h where h.id = habit_id and h.owner_id = habit_logs.owner_id)
  );
create policy "habit_logs: delete" on public.habit_logs for delete to authenticated
  using (public.has_module_access(owner_id, 'habits', 'write'));

-- Grocery list: every household member reads and writes.
create policy "grocery: members read" on public.grocery_items for select to authenticated
  using (public.is_household_member(household_id));
create policy "grocery: members insert" on public.grocery_items for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "grocery: members update" on public.grocery_items for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "grocery: members delete" on public.grocery_items for delete to authenticated
  using (public.is_household_member(household_id));

-- Live updates for the shared grocery list.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.grocery_items;
  end if;
end $$;

-- ------------------------------------------- default modules for households --
create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.households (name, created_by)
  values (trim(household_name), auth.uid())
  returning id into hid;

  insert into public.household_members (household_id, user_id, role)
  values (hid, auth.uid(), 'owner');

  insert into public.household_modules (household_id, module_key, enabled)
  select hid, k, true
  from unnest(array[
    'medical_records', 'medicines', 'supplements', 'bladder_diary', 'pelvic_floor', 'checkin', 'habits', 'groceries'
  ]) as k;

  update public.profiles set active_household_id = hid where id = auth.uid();
  return hid;
end;
$$;

-- Switch the new modules on for households that already exist.
insert into public.household_modules (household_id, module_key, enabled)
select h.id, k, true
from public.households h
cross join unnest(array['medicines', 'supplements', 'bladder_diary', 'pelvic_floor', 'checkin', 'habits', 'groceries']) as k
on conflict (household_id, module_key) do nothing;
