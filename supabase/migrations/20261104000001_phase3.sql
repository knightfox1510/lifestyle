-- Phase 3: notifications (web push subscriptions, preferences, send log,
-- weekly digests), fitness classes + workout log, child routine
-- (dependents, logs, vaccinations, growth), home maintenance, document
-- expiry vault and subscriptions roster.

-- ----------------------------------------------------------- notifications --
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  medicines boolean not null default true,
  fitness boolean not null default true,
  expiries boolean not null default true,
  renewals boolean not null default true,
  maintenance boolean not null default true,
  child boolean not null default true,
  digest boolean not null default true,
  daily_hour smallint not null default 9 check (daily_hour between 0 and 23),
  quiet_start time,
  quiet_end time,
  updated_at timestamptz not null default now()
);
create trigger notification_prefs_updated_at before update on public.notification_prefs
  for each row execute function public.set_updated_at();

-- One row per notification actually sent; ref_key makes sends idempotent.
create table public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  ref_key text not null,
  title text not null,
  body text,
  url text,
  sent_at timestamptz not null default now(),
  unique (user_id, ref_key)
);
create index notification_log_user_idx on public.notification_log (user_id, sent_at desc);

create table public.digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------- fitness --
create table public.fitness_classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  kind text not null default 'gym' check (kind in ('gym', 'yoga', 'pilates', 'swim', 'run', 'walk', 'cycle', 'dance', 'sport', 'class', 'physio', 'other')),
  days_of_week smallint[] not null check (array_length(days_of_week, 1) between 1 and 7 and days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_minutes smallint not null default 60 check (duration_minutes between 5 and 480),
  location text check (char_length(location) <= 120),
  instructor text check (char_length(instructor) <= 120),
  remind_minutes_before smallint check (remind_minutes_before between 0 and 1440),
  active boolean not null default true,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  performed_on date not null,
  class_id uuid references public.fitness_classes (id) on delete set null,
  kind text not null default 'gym' check (kind in ('gym', 'yoga', 'pilates', 'swim', 'run', 'walk', 'cycle', 'dance', 'sport', 'class', 'physio', 'other')),
  title text not null check (char_length(title) between 1 and 100),
  status text not null default 'done' check (status in ('done', 'skipped')),
  duration_minutes smallint check (duration_minutes between 1 and 600),
  intensity smallint check (intensity between 1 and 5),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index workout_logs_owner_idx on public.workout_logs (owner_id, performed_on desc);
create unique index workout_logs_class_day_idx on public.workout_logs (class_id, performed_on) where class_id is not null;

-- ------------------------------------------------------- child / dependents --
create table public.dependents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'child' check (kind in ('child', 'pet')),
  date_of_birth date,
  sex text check (sex in ('female', 'male', 'other')),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

create table public.child_logs (
  id uuid primary key default gen_random_uuid(),
  dependent_id uuid not null references public.dependents (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null check (kind in ('feed', 'sleep', 'diaper', 'medicine', 'temperature', 'milestone', 'note')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  amount_ml smallint check (amount_ml between 0 and 2000),
  value numeric(5, 2),
  detail text check (char_length(detail) <= 300),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index child_logs_dep_idx on public.child_logs (dependent_id, started_at desc);

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  dependent_id uuid not null references public.dependents (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  vaccine text not null check (char_length(vaccine) between 1 and 120),
  due_on date,
  given_on date,
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);
create index vaccinations_dep_idx on public.vaccinations (dependent_id, due_on);

create table public.growth_records (
  id uuid primary key default gen_random_uuid(),
  dependent_id uuid not null references public.dependents (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 2) check (weight_kg between 0.3 and 200),
  height_cm numeric(5, 1) check (height_cm between 20 and 250),
  head_cm numeric(4, 1) check (head_cm between 20 and 70),
  created_at timestamptz not null default now(),
  check (num_nonnulls(weight_kg, height_cm, head_cm) > 0)
);

-- Child rows must belong to the same household as their dependent.
create or replace function public.dependent_household_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.dependents d where d.id = new.dependent_id and d.household_id = new.household_id) then
    raise exception 'dependent not in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger child_logs_household before insert or update on public.child_logs for each row execute function public.dependent_household_check();
create trigger vaccinations_household before insert or update on public.vaccinations for each row execute function public.dependent_household_check();
create trigger growth_household before insert or update on public.growth_records for each row execute function public.dependent_household_check();

-- ------------------------------------------------------------ maintenance --
create table public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  category text not null default 'home' check (category in ('appliance', 'vehicle', 'home', 'insurance', 'health', 'other')),
  interval_days smallint check (interval_days between 1 and 3650),
  last_done_on date,
  next_due_on date,
  remind_days_before smallint not null default 7 check (remind_days_before between 0 and 120),
  vendor text check (char_length(vendor) <= 120),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create table public.maintenance_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.maintenance_tasks (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  done_on date not null,
  done_by uuid default auth.uid() references auth.users (id) on delete set null,
  cost numeric(10, 2) check (cost >= 0),
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------- document vault --
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  scope text not null default 'personal' check (scope in ('personal', 'household')),
  title text not null check (char_length(title) between 1 and 120),
  doc_type text not null default 'other' check (doc_type in (
    'passport', 'visa', 'national_id', 'driving_licence', 'pan', 'vehicle_rc', 'vehicle_insurance', 'health_insurance',
    'life_insurance', 'home_insurance', 'warranty', 'lease', 'membership', 'other'
  )),
  holder text check (char_length(holder) <= 80),
  -- Only the last 4 characters are ever stored, never the full number.
  number_last4 text check (number_last4 ~ '^[A-Za-z0-9]{1,4}$'),
  issued_on date,
  expires_on date,
  remind_days_before smallint not null default 60 check (remind_days_before between 0 and 365),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_household_idx on public.documents (household_id, expires_on);
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------- subscriptions --
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'streaming' check (category in ('streaming', 'music', 'food', 'shopping', 'utilities', 'software', 'fitness', 'news', 'cloud', 'other')),
  cost numeric(10, 2) check (cost >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
  next_renewal_on date,
  paid_by uuid references auth.users (id) on delete set null,
  auto_renew boolean not null default true,
  url text check (char_length(url) <= 300),
  notes text check (char_length(notes) <= 300),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- RLS --
alter table public.push_subscriptions enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notification_log enable row level security;
alter table public.digests enable row level security;
alter table public.fitness_classes enable row level security;
alter table public.workout_logs enable row level security;
alter table public.dependents enable row level security;
alter table public.child_logs enable row level security;
alter table public.vaccinations enable row level security;
alter table public.growth_records enable row level security;
alter table public.maintenance_tasks enable row level security;
alter table public.maintenance_log enable row level security;
alter table public.documents enable row level security;
alter table public.subscriptions enable row level security;

-- Own-user tables. The notification log and digests are written by the
-- server (service role); users only read them.
create policy "push subs: own" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notification prefs: own" on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notification log: read own" on public.notification_log for select to authenticated
  using (user_id = auth.uid());
create policy "digests: read own" on public.digests for select to authenticated
  using (user_id = auth.uid());

do $$
declare
  t record;
begin
  -- Personal fitness tables (shareable like other personal modules).
  for t in select unnest(array['fitness_classes', 'workout_logs']) as tbl
  loop
    execute format('create policy "%1$s: read" on public.%1$I for select to authenticated using (public.has_module_access(owner_id, ''fitness'', ''read''))', t.tbl);
    execute format('create policy "%1$s: insert" on public.%1$I for insert to authenticated with check (public.has_module_access(owner_id, ''fitness'', ''write'') and public.is_household_member(household_id))', t.tbl);
    execute format('create policy "%1$s: update" on public.%1$I for update to authenticated using (public.has_module_access(owner_id, ''fitness'', ''write'')) with check (public.has_module_access(owner_id, ''fitness'', ''write'') and public.is_household_member(household_id))', t.tbl);
    execute format('create policy "%1$s: owner delete" on public.%1$I for delete to authenticated using (owner_id = auth.uid())', t.tbl);
  end loop;

  -- Household-shared tables.
  for t in select unnest(array[
    'dependents', 'child_logs', 'vaccinations', 'growth_records', 'maintenance_tasks', 'maintenance_log', 'subscriptions'
  ]) as tbl
  loop
    execute format('create policy "%1$s: members read" on public.%1$I for select to authenticated using (public.is_household_member(household_id))', t.tbl);
    execute format('create policy "%1$s: members insert" on public.%1$I for insert to authenticated with check (public.is_household_member(household_id))', t.tbl);
    execute format('create policy "%1$s: members update" on public.%1$I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t.tbl);
    execute format('create policy "%1$s: members delete" on public.%1$I for delete to authenticated using (public.is_household_member(household_id))', t.tbl);
  end loop;
end $$;

-- Documents mix personal (passport) and household (home insurance) rows.
create policy "documents: read" on public.documents for select to authenticated
  using (public.can_access_row(owner_id, household_id, scope, 'documents', 'read'));
create policy "documents: insert" on public.documents for insert to authenticated
  with check (owner_id = auth.uid() and public.is_household_member(household_id));
create policy "documents: update" on public.documents for update to authenticated
  using (public.can_access_row(owner_id, household_id, scope, 'documents', 'write'))
  with check (public.can_access_row(owner_id, household_id, scope, 'documents', 'write') and public.is_household_member(household_id));
create policy "documents: delete" on public.documents for delete to authenticated
  using (owner_id = auth.uid() or (scope = 'household' and public.is_household_member(household_id)));

-- Subscriptions: "paid by" must be a member of the same household.
create or replace function public.subscription_payer_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.paid_by is not null and not exists (
    select 1 from public.household_members m where m.household_id = new.household_id and m.user_id = new.paid_by
  ) then
    raise exception 'payer is not in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger subscriptions_payer before insert or update on public.subscriptions
  for each row execute function public.subscription_payer_check();

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
    'medical_records', 'medicines', 'supplements', 'bladder_diary', 'pelvic_floor', 'checkin', 'habits', 'groceries',
    'food_diary', 'body_recomp', 'pantry', 'recipes',
    'fitness', 'maintenance', 'documents', 'subscriptions'
  ]) as k;

  -- The child tracker is opt-in (not every household has children).
  insert into public.household_modules (household_id, module_key, enabled) values (hid, 'child', false);

  update public.profiles set active_household_id = hid where id = auth.uid();
  return hid;
end;
$$;

insert into public.household_modules (household_id, module_key, enabled)
select h.id, k, true
from public.households h
cross join unnest(array['fitness', 'maintenance', 'documents', 'subscriptions', 'child']) as k
on conflict (household_id, module_key) do nothing;
