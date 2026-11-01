-- Phase 4: couples' watchlist, takeout & dining vault, travel (trips,
-- itinerary, packing lists + templates), occasions & private gift ideas,
-- wearable data (webhook tokens + daily metrics), and account deletion.

-- -------------------------------------------------------------- watchlist --
create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 150),
  kind text not null default 'series' check (kind in ('series', 'movie', 'documentary', 'anime', 'other')),
  platform text check (char_length(platform) <= 60),
  status text not null default 'want' check (status in ('want', 'watching', 'paused', 'finished', 'dropped')),
  together boolean not null default true,
  total_seasons smallint check (total_seasons between 1 and 100),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger watchlist_items_updated_at before update on public.watchlist_items
  for each row execute function public.set_updated_at();

-- Each person's own position, so nobody "watches ahead" unnoticed.
create table public.watch_progress (
  item_id uuid not null references public.watchlist_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  season smallint not null default 1 check (season between 0 and 100),
  episode smallint not null default 0 check (episode between 0 and 2000),
  rating smallint check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

-- ----------------------------------------------------------------- dining --
create table public.dining_places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  cuisine text check (char_length(cuisine) <= 60),
  area text check (char_length(area) <= 80),
  mode text not null default 'both' check (mode in ('delivery', 'dine_in', 'both')),
  order_via text check (char_length(order_via) <= 40),
  favorite boolean not null default false,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create table public.dining_dishes (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.dining_places (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  price numeric(8, 2) check (price >= 0),
  veg boolean,
  calories integer check (calories between 0 and 5000),
  protein_g numeric(6, 1) check (protein_g between 0 and 500),
  -- Household members for whom this is a go-to order.
  go_to_for uuid[] not null default '{}',
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);

create table public.dining_orders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  place_id uuid references public.dining_places (id) on delete set null,
  ordered_by uuid default auth.uid() references auth.users (id) on delete set null,
  ordered_on date not null default current_date,
  items text not null check (char_length(items) between 1 and 500),
  total numeric(10, 2) check (total >= 0),
  rating smallint check (rating between 1 and 5),
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------- travel --
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  destination text check (char_length(destination) <= 120),
  start_date date,
  end_date date,
  status text not null default 'idea' check (status in ('idea', 'planning', 'booked', 'done')),
  budget numeric(12, 2) check (budget >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  day_date date,
  kind text not null default 'idea' check (kind in ('idea', 'link', 'flight', 'stay', 'transport', 'activity', 'food', 'note')),
  title text not null check (char_length(title) between 1 and 200),
  url text check (char_length(url) <= 500),
  start_time text check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location text check (char_length(location) <= 200),
  cost numeric(12, 2) check (cost >= 0),
  booked boolean not null default false,
  notes text check (char_length(notes) <= 1000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index trip_items_trip_idx on public.trip_items (trip_id, day_date, start_time);

create table public.packing_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- [{ "name": "Passport", "category": "documents", "qty": 1 }]
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now()
);

create table public.trip_packing (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'other' check (char_length(category) <= 40),
  qty smallint not null default 1 check (qty between 1 and 99),
  for_user uuid references auth.users (id) on delete set null,
  packed boolean not null default false,
  created_at timestamptz not null default now()
);
create index trip_packing_trip_idx on public.trip_packing (trip_id);

-- Child rows of a trip must be in the trip's household.
create or replace function public.trip_household_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.trips t where t.id = new.trip_id and t.household_id = new.household_id) then
    raise exception 'trip not in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger trip_items_household before insert or update on public.trip_items for each row execute function public.trip_household_check();
create trigger trip_packing_household before insert or update on public.trip_packing for each row execute function public.trip_household_check();

create or replace function public.dish_household_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.dining_places p where p.id = new.place_id and p.household_id = new.household_id) then
    raise exception 'place not in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger dining_dishes_household before insert or update on public.dining_dishes for each row execute function public.dish_household_check();

create or replace function public.watch_progress_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.watchlist_items w where w.id = new.item_id and w.household_id = new.household_id) then
    raise exception 'item not in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger watch_progress_household before insert or update on public.watch_progress for each row execute function public.watch_progress_check();

-- -------------------------------------------------------------- occasions --
create table public.occasions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'birthday' check (kind in ('birthday', 'anniversary', 'festival', 'other')),
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31),
  year smallint check (year between 1900 and 2200),
  recurring boolean not null default true,
  person text check (char_length(person) <= 80),
  remind_days_before smallint not null default 7 check (remind_days_before between 0 and 60),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

-- Gift ideas are strictly private to their author (so a partner can't see
-- the surprise), never shared even with module grants.
create table public.gift_ideas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  occasion_id uuid references public.occasions (id) on delete set null,
  for_person text not null check (char_length(for_person) between 1 and 80),
  idea text not null check (char_length(idea) between 1 and 200),
  url text check (char_length(url) <= 500),
  price numeric(10, 2) check (price >= 0),
  status text not null default 'idea' check (status in ('idea', 'bought', 'given')),
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- wearables --
create table public.wearable_daily (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  day date not null,
  source text not null default 'manual' check (source in ('manual', 'csv', 'webhook')),
  steps integer check (steps between 0 and 200000),
  resting_hr smallint check (resting_hr between 20 and 220),
  avg_hr smallint check (avg_hr between 20 and 220),
  sleep_minutes smallint check (sleep_minutes between 0 and 1440),
  deep_sleep_minutes smallint check (deep_sleep_minutes between 0 and 1440),
  active_minutes smallint check (active_minutes between 0 and 1440),
  calories_burned integer check (calories_burned between 0 and 20000),
  hrv_ms smallint check (hrv_ms between 0 and 500),
  updated_at timestamptz not null default now(),
  unique (owner_id, day)
);
create trigger wearable_daily_updated_at before update on public.wearable_daily
  for each row execute function public.set_updated_at();

-- Per-user ingest tokens for the webhook. Only a SHA-256 hash is stored.
create table public.ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  label text not null default 'Wearable sync' check (char_length(label) <= 60),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- ------------------------------------------------------------------- RLS --
alter table public.watchlist_items enable row level security;
alter table public.watch_progress enable row level security;
alter table public.dining_places enable row level security;
alter table public.dining_dishes enable row level security;
alter table public.dining_orders enable row level security;
alter table public.trips enable row level security;
alter table public.trip_items enable row level security;
alter table public.packing_templates enable row level security;
alter table public.trip_packing enable row level security;
alter table public.occasions enable row level security;
alter table public.gift_ideas enable row level security;
alter table public.wearable_daily enable row level security;
alter table public.ingest_tokens enable row level security;

do $$
declare
  t record;
begin
  for t in select unnest(array[
    'watchlist_items', 'dining_places', 'dining_dishes', 'dining_orders', 'trips', 'trip_items',
    'packing_templates', 'trip_packing', 'occasions'
  ]) as tbl
  loop
    execute format('create policy "%1$s: members read" on public.%1$I for select to authenticated using (public.is_household_member(household_id))', t.tbl);
    execute format('create policy "%1$s: members insert" on public.%1$I for insert to authenticated with check (public.is_household_member(household_id))', t.tbl);
    execute format('create policy "%1$s: members update" on public.%1$I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t.tbl);
    execute format('create policy "%1$s: members delete" on public.%1$I for delete to authenticated using (public.is_household_member(household_id))', t.tbl);
  end loop;
end $$;

-- Watch progress: everyone in the household can see it (that's the point),
-- but each person only moves their own marker.
create policy "watch progress: members read" on public.watch_progress for select to authenticated
  using (public.is_household_member(household_id));
create policy "watch progress: own insert" on public.watch_progress for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "watch progress: own update" on public.watch_progress for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "watch progress: own delete" on public.watch_progress for delete to authenticated
  using (user_id = auth.uid());

create policy "gift ideas: author only" on public.gift_ideas for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.is_household_member(household_id));

create policy "wearables: read" on public.wearable_daily for select to authenticated
  using (public.has_module_access(owner_id, 'wearables', 'read'));
create policy "wearables: insert" on public.wearable_daily for insert to authenticated
  with check (owner_id = auth.uid() and public.is_household_member(household_id));
create policy "wearables: update" on public.wearable_daily for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "wearables: delete" on public.wearable_daily for delete to authenticated
  using (owner_id = auth.uid());

create policy "ingest tokens: own" on public.ingest_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -------------------------------------------- household switching / deletion --

-- A household outlives its creator (ownership is handed on), so the creator
-- reference must not block account deletion.
alter table public.households alter column created_by drop not null;
alter table public.households drop constraint households_created_by_fkey;
alter table public.households add constraint households_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- Switch the active household (must be a member).
create or replace function public.switch_household(hid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_member(hid) then
    raise exception 'not a member of this household';
  end if;
  update public.profiles set active_household_id = hid where id = auth.uid();
end;
$$;
revoke all on function public.switch_household(uuid) from public, anon;
grant execute on function public.switch_household(uuid) to authenticated;

-- Before an account is deleted: hand household ownership to another member
-- (oldest first) and remove households that would be left empty.
create or replace function public.prepare_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  heir uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  for m in select household_id, role from public.household_members where user_id = auth.uid()
  loop
    select user_id into heir from public.household_members
    where household_id = m.household_id and user_id <> auth.uid()
    order by joined_at limit 1;
    if heir is null then
      delete from public.households where id = m.household_id;
    elsif m.role = 'owner' then
      update public.household_members set role = 'owner' where household_id = m.household_id and user_id = heir;
    end if;
  end loop;
end;
$$;
revoke all on function public.prepare_account_deletion() from public, anon;
grant execute on function public.prepare_account_deletion() to authenticated;

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
    'fitness', 'maintenance', 'documents', 'subscriptions',
    'watchlist', 'dining', 'travel', 'occasions', 'wearables'
  ]) as k;

  insert into public.household_modules (household_id, module_key, enabled) values (hid, 'child', false);

  update public.profiles set active_household_id = hid where id = auth.uid();
  return hid;
end;
$$;

insert into public.household_modules (household_id, module_key, enabled)
select h.id, k, true
from public.households h
cross join unnest(array['watchlist', 'dining', 'travel', 'occasions', 'wearables']) as k
on conflict (household_id, module_key) do nothing;

-- Notification preferences for the new reminder types.
alter table public.notification_prefs
  add column occasions boolean not null default true,
  add column travel boolean not null default true;
