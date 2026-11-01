-- Foundation: profiles, households, membership, invites, module toggles,
-- partner sharing, home widgets, AI settings/usage and the shared RLS helpers
-- that every feature module reuses.

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  timezone text not null default 'Asia/Kolkata',
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  -- Default for "use my medical history when AI makes suggestions".
  -- Every AI request can override this per call.
  ai_use_medical_history boolean not null default true,
  active_household_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Households & membership
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid not null references auth.users (id),
  ai_daily_limit integer not null default 50 check (ai_daily_limit between 0 and 1000),
  has_custom_ai_key boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_updated_at before update on public.households
  for each row execute function public.set_updated_at();

alter table public.profiles
  add constraint profiles_active_household_fk
  foreign key (active_household_id) references public.households (id) on delete set null;

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_idx on public.household_members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Feature modules: per-household on/off + settings
-- ---------------------------------------------------------------------------
create table public.household_modules (
  household_id uuid not null references public.households (id) on delete cascade,
  module_key text not null check (module_key ~ '^[a-z_]{2,40}$'),
  enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, module_key)
);

create trigger household_modules_updated_at before update on public.household_modules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Partner sharing: one row per (owner, grantee, module). No row = no access.
-- ---------------------------------------------------------------------------
create table public.module_shares (
  owner_id uuid not null references auth.users (id) on delete cascade,
  grantee_id uuid not null references auth.users (id) on delete cascade,
  module_key text not null check (module_key ~ '^[a-z_]{2,40}$'),
  level text not null check (level in ('read', 'write')),
  updated_at timestamptz not null default now(),
  primary key (owner_id, grantee_id, module_key),
  check (owner_id <> grantee_id)
);

create trigger module_shares_updated_at before update on public.module_shares
  for each row execute function public.set_updated_at();

-- Audit trail: who looked at someone else's shared data.
create table public.share_access_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  viewer_id uuid not null references auth.users (id) on delete cascade,
  module_key text not null,
  viewed_at timestamptz not null default now()
);

create index share_access_log_owner_idx on public.share_access_log (owner_id, viewed_at desc);

-- ---------------------------------------------------------------------------
-- Home widgets (per user)
-- ---------------------------------------------------------------------------
create table public.user_widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  widget_key text not null check (widget_key ~ '^[a-z_.]{2,60}$'),
  position integer not null default 0,
  size text not null default 'md' check (size in ('sm', 'md', 'lg')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, widget_key)
);

-- ---------------------------------------------------------------------------
-- AI: secrets (service role only) and usage log (for daily caps)
-- ---------------------------------------------------------------------------
create table public.household_secrets (
  household_id uuid primary key references public.households (id) on delete cascade,
  gemini_key_ciphertext text,
  gemini_key_last4 text,
  updated_at timestamptz not null default now()
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  used_medical_context boolean not null default false,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index ai_usage_household_day_idx on public.ai_usage (household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS helper functions (security definer so they can read membership tables
-- without recursive policy evaluation).
-- ---------------------------------------------------------------------------
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- True when the current user and `other` belong to at least one common household.
create or replace function public.shares_household(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members a
    join public.household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Personal data access: the owner always; anyone else only with an explicit
-- module_shares grant from the owner AND while they still share a household.
create or replace function public.has_module_access(owner uuid, module text, min_level text default 'read')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
      owner = auth.uid()
      or (
        exists (
          select 1 from public.module_shares s
          where s.owner_id = owner
            and s.grantee_id = auth.uid()
            and s.module_key = module
            and (min_level = 'read' or s.level = 'write')
        )
        and public.shares_household(owner)
      )
    );
$$;

-- Generic row check for future modules that mix household-shared rows
-- (groceries, maintenance, child routine) with personal rows (diaries).
create or replace function public.can_access_row(
  owner uuid, hid uuid, row_scope text, module text, min_level text default 'read'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when row_scope = 'household' then public.is_household_member(hid)
    else public.has_module_access(owner, module, min_level)
  end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs for household lifecycle (atomic, bypass RLS in a controlled way)
-- ---------------------------------------------------------------------------
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

  -- Foundation modules switched on by default.
  insert into public.household_modules (household_id, module_key, enabled)
  values (hid, 'medical_records', true);

  update public.profiles set active_household_id = hid where id = auth.uid();
  return hid;
end;
$$;

create or replace function public.create_invite(hid uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
begin
  if not public.is_household_member(hid) then
    raise exception 'not a member of this household';
  end if;

  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites (household_id, code, created_by)
  values (hid, new_code, auth.uid());
  return new_code;
end;
$$;

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

-- Leaving a household also revokes every share between the leaver and the
-- remaining members (in both directions).
create or replace function public.leave_household(hid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.module_shares s
  where (s.owner_id = auth.uid() and s.grantee_id in (select user_id from public.household_members where household_id = hid))
     or (s.grantee_id = auth.uid() and s.owner_id in (select user_id from public.household_members where household_id = hid));

  delete from public.household_members where household_id = hid and user_id = auth.uid();

  update public.profiles set active_household_id = null
  where id = auth.uid() and active_household_id = hid;

  -- Remove the household when its last member leaves.
  delete from public.households h
  where h.id = hid and not exists (select 1 from public.household_members m where m.household_id = hid);
end;
$$;

revoke all on function public.create_household(text) from public, anon;
revoke all on function public.create_invite(uuid) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
revoke all on function public.leave_household(uuid) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invites enable row level security;
alter table public.household_modules enable row level security;
alter table public.module_shares enable row level security;
alter table public.share_access_log enable row level security;
alter table public.user_widgets enable row level security;
alter table public.household_secrets enable row level security; -- no policies: service role only
alter table public.ai_usage enable row level security;

-- profiles
create policy "profiles: read self and household members" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_household(id));
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (
    id = auth.uid()
    and (active_household_id is null or public.is_household_member(active_household_id))
  );

-- households
create policy "households: members read" on public.households
  for select to authenticated using (public.is_household_member(id));
create policy "households: owners update" on public.households
  for update to authenticated using (public.is_household_owner(id)) with check (public.is_household_owner(id));

-- household_members (writes go through RPCs; owners may remove members)
create policy "members: read own households" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));
create policy "members: owner removes others" on public.household_members
  for delete to authenticated using (public.is_household_owner(household_id) and user_id <> auth.uid());

-- invites
create policy "invites: members read" on public.invites
  for select to authenticated using (public.is_household_member(household_id));
create policy "invites: members revoke" on public.invites
  for delete to authenticated using (public.is_household_member(household_id));

-- household_modules
create policy "modules: members read" on public.household_modules
  for select to authenticated using (public.is_household_member(household_id));
create policy "modules: members insert" on public.household_modules
  for insert to authenticated with check (public.is_household_member(household_id));
create policy "modules: members update" on public.household_modules
  for update to authenticated using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- module_shares: owners manage their grants, grantees can see what they were given
create policy "shares: owner or grantee read" on public.module_shares
  for select to authenticated using (owner_id = auth.uid() or grantee_id = auth.uid());
create policy "shares: owner grants to household member" on public.module_shares
  for insert to authenticated with check (owner_id = auth.uid() and public.shares_household(grantee_id));
create policy "shares: owner updates" on public.module_shares
  for update to authenticated using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.shares_household(grantee_id));
create policy "shares: owner revokes" on public.module_shares
  for delete to authenticated using (owner_id = auth.uid());

-- share_access_log
create policy "access log: owner and viewer read" on public.share_access_log
  for select to authenticated using (owner_id = auth.uid() or viewer_id = auth.uid());
create policy "access log: viewer records own view" on public.share_access_log
  for insert to authenticated with check (
    viewer_id = auth.uid() and owner_id <> auth.uid() and public.has_module_access(owner_id, module_key, 'read')
  );

-- user_widgets
create policy "widgets: own" on public.user_widgets
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ai_usage
create policy "ai usage: members read" on public.ai_usage
  for select to authenticated using (public.is_household_member(household_id));
create policy "ai usage: record own" on public.ai_usage
  for insert to authenticated with check (user_id = auth.uid() and public.is_household_member(household_id));
