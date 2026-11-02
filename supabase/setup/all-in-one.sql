-- Hearth: complete database setup (all migrations in order).
-- Paste this whole file into Supabase → SQL Editor → New query → Run, ONCE,
-- on a new, empty project. Generated from supabase/migrations/ by
-- scripts/build-setup-sql.mjs; don't edit by hand.

-- ============================================================
-- 20261101000001_foundation.sql
-- ============================================================

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

-- ============================================================
-- 20261101000002_medical_records.sql
-- ============================================================

-- Medical records module: a per-person medical profile, uploaded hospital
-- papers/reports, and a timeline of medical events (illnesses, surgeries,
-- medications taken, allergies, tests, visits...). Everything is personal and
-- private by default; a partner sees it only through a module_shares grant on
-- 'medical_records'. Each row has include_in_ai so the owner can exclude it
-- from AI suggestions.

create table public.medical_profiles (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  date_of_birth date,
  sex text check (sex in ('female', 'male', 'other')),
  blood_group text check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  height_cm numeric(5, 1) check (height_cm between 30 and 260),
  notes text check (char_length(notes) <= 4000),
  include_in_ai boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger medical_profiles_updated_at before update on public.medical_profiles
  for each row execute function public.set_updated_at();

create table public.medical_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  doc_type text not null default 'other' check (doc_type in (
    'discharge_summary', 'prescription', 'lab_report', 'imaging', 'consultation', 'vaccination', 'insurance', 'other'
  )),
  document_date date,
  provider text check (char_length(provider) <= 200),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 20 * 1024 * 1024),
  notes text check (char_length(notes) <= 4000),
  ai_summary text,
  ai_extracted jsonb,
  ai_processed_at timestamptz,
  include_in_ai boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medical_documents_owner_idx on public.medical_documents (owner_id, document_date desc nulls last);

create trigger medical_documents_updated_at before update on public.medical_documents
  for each row execute function public.set_updated_at();

create table public.medical_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  category text not null check (category in (
    'condition', 'illness', 'symptom', 'injury', 'surgery', 'procedure', 'hospitalization',
    'medication', 'allergy', 'vaccination', 'test', 'visit', 'other'
  )),
  title text not null check (char_length(title) between 1 and 200),
  details text check (char_length(details) <= 4000),
  start_date date not null,
  end_date date,
  ongoing boolean not null default false,
  severity text check (severity in ('mild', 'moderate', 'severe')),
  -- Medication specifics (only meaningful when category = 'medication').
  dosage text check (char_length(dosage) <= 120),
  frequency text check (char_length(frequency) <= 120),
  -- e.g. a medication taken "for" an illness event.
  related_event_id uuid references public.medical_events (id) on delete set null,
  document_id uuid references public.medical_documents (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'ai_extracted')),
  include_in_ai boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index medical_events_owner_idx on public.medical_events (owner_id, start_date desc);

create trigger medical_events_updated_at before update on public.medical_events
  for each row execute function public.set_updated_at();

alter table public.medical_profiles enable row level security;
alter table public.medical_documents enable row level security;
alter table public.medical_events enable row level security;

-- medical_profiles
create policy "medical profile: read" on public.medical_profiles
  for select to authenticated using (public.has_module_access(owner_id, 'medical_records', 'read'));
create policy "medical profile: owner insert" on public.medical_profiles
  for insert to authenticated with check (owner_id = auth.uid());
create policy "medical profile: write" on public.medical_profiles
  for update to authenticated using (public.has_module_access(owner_id, 'medical_records', 'write'))
  with check (public.has_module_access(owner_id, 'medical_records', 'write'));
create policy "medical profile: owner delete" on public.medical_profiles
  for delete to authenticated using (owner_id = auth.uid());

-- medical_documents
create policy "medical docs: read" on public.medical_documents
  for select to authenticated using (public.has_module_access(owner_id, 'medical_records', 'read'));
create policy "medical docs: insert" on public.medical_documents
  for insert to authenticated with check (
    created_by = auth.uid()
    and public.has_module_access(owner_id, 'medical_records', 'write')
    and public.is_household_member(household_id)
  );
create policy "medical docs: update" on public.medical_documents
  for update to authenticated using (public.has_module_access(owner_id, 'medical_records', 'write'))
  with check (public.has_module_access(owner_id, 'medical_records', 'write'));
create policy "medical docs: owner delete" on public.medical_documents
  for delete to authenticated using (owner_id = auth.uid());

-- medical_events
create policy "medical events: read" on public.medical_events
  for select to authenticated using (public.has_module_access(owner_id, 'medical_records', 'read'));
create policy "medical events: insert" on public.medical_events
  for insert to authenticated with check (
    created_by = auth.uid()
    and public.has_module_access(owner_id, 'medical_records', 'write')
    and public.is_household_member(household_id)
  );
create policy "medical events: update" on public.medical_events
  for update to authenticated using (public.has_module_access(owner_id, 'medical_records', 'write'))
  with check (public.has_module_access(owner_id, 'medical_records', 'write'));
create policy "medical events: owner delete" on public.medical_events
  for delete to authenticated using (owner_id = auth.uid());

-- ============================================================
-- 20261101000003_medical_storage.sql
-- ============================================================

-- Private Storage bucket for hospital papers / reports.
-- Object paths are "<owner_id>/<uuid>.<ext>", so the first folder is the owner.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-documents',
  'medical-documents',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "medical files: read with module access" on storage.objects
  for select to authenticated using (
    bucket_id = 'medical-documents'
    and public.has_module_access(((storage.foldername(name))[1])::uuid, 'medical_records', 'read')
  );

create policy "medical files: upload with write access" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'medical-documents'
    and public.has_module_access(((storage.foldername(name))[1])::uuid, 'medical_records', 'write')
  );

create policy "medical files: owner delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 20261102000001_phase1.sql
-- ============================================================

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

-- ============================================================
-- 20261103000001_phase2.sql
-- ============================================================

-- Phase 2: food diary + nutrition goals, body recomposition (weight,
-- measurements, vitals, goals), household pantry with expiry, recipes, meal
-- plan, and structured lab results (blood work) under medical records.

-- ------------------------------------------------------------ nutrition --
create table public.nutrition_goals (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  goal text not null default 'maintain' check (goal in ('lose', 'maintain', 'gain', 'recomp')),
  calories integer check (calories between 800 and 6000),
  protein_g integer check (protein_g between 0 and 400),
  carbs_g integer check (carbs_g between 0 and 800),
  fat_g integer check (fat_g between 0 and 300),
  fiber_g integer check (fiber_g between 0 and 100),
  water_ml integer check (water_ml between 0 and 6000),
  diet_type text not null default 'any' check (diet_type in ('any', 'vegetarian', 'eggetarian', 'vegan', 'jain', 'pescatarian', 'non_vegetarian')),
  activity_level text not null default 'moderate' check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  cuisines text[] not null default '{}',
  cooking_style text not null default 'quick' check (cooking_style in ('quick', 'balanced', 'elaborate', 'meal_prep')),
  dislikes text check (char_length(dislikes) <= 500),
  rationale text check (char_length(rationale) <= 2000),
  updated_at timestamptz not null default now()
);
create trigger nutrition_goals_updated_at before update on public.nutrition_goals
  for each row execute function public.set_updated_at();

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text not null check (char_length(description) between 1 and 200),
  quantity text check (char_length(quantity) <= 60),
  calories integer check (calories between 0 and 5000),
  protein_g numeric(6, 1) check (protein_g between 0 and 500),
  carbs_g numeric(6, 1) check (carbs_g between 0 and 1000),
  fat_g numeric(6, 1) check (fat_g between 0 and 500),
  fiber_g numeric(6, 1) check (fiber_g between 0 and 200),
  source text not null default 'manual' check (source in ('manual', 'ai_estimate', 'recipe', 'photo')),
  recipe_id uuid,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index food_entries_owner_idx on public.food_entries (owner_id, eaten_at desc);

-- --------------------------------------------------- body recomposition --
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(5, 2) check (weight_kg between 20 and 350),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 75),
  waist_cm numeric(5, 1) check (waist_cm between 30 and 250),
  hip_cm numeric(5, 1) check (hip_cm between 30 and 250),
  chest_cm numeric(5, 1) check (chest_cm between 30 and 250),
  arm_cm numeric(4, 1) check (arm_cm between 10 and 80),
  thigh_cm numeric(5, 1) check (thigh_cm between 20 and 120),
  resting_hr smallint check (resting_hr between 25 and 220),
  bp_systolic smallint check (bp_systolic between 60 and 260),
  bp_diastolic smallint check (bp_diastolic between 30 and 160),
  blood_glucose_mgdl smallint check (blood_glucose_mgdl between 20 and 600),
  glucose_context text check (glucose_context in ('fasting', 'post_meal', 'random')),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  check (num_nonnulls(weight_kg, body_fat_pct, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, resting_hr, bp_systolic, blood_glucose_mgdl) > 0)
);
create index body_metrics_owner_idx on public.body_metrics (owner_id, measured_at desc);

create table public.body_goals (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  start_weight_kg numeric(5, 2) check (start_weight_kg between 20 and 350),
  target_weight_kg numeric(5, 2) check (target_weight_kg between 20 and 350),
  target_date date,
  target_body_fat_pct numeric(4, 1) check (target_body_fat_pct between 2 and 75),
  milestones numeric(5, 2)[] not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger body_goals_updated_at before update on public.body_goals
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------ pantry (shared) --
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  quantity text check (char_length(quantity) <= 40),
  category text not null default 'other' check (category in (
    'produce', 'dairy', 'meat', 'bakery', 'pantry', 'frozen', 'beverages', 'snacks', 'household', 'personal_care', 'baby', 'other'
  )),
  location text not null default 'fridge' check (location in ('fridge', 'freezer', 'pantry')),
  purchased_on date,
  expires_on date,
  expiry_estimated boolean not null default false,
  opened boolean not null default false,
  notes text check (char_length(notes) <= 300),
  used_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pantry_items_household_idx on public.pantry_items (household_id, expires_on) where used_up_at is null;
create trigger pantry_items_updated_at before update on public.pantry_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------- recipes & meal plan --
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 150),
  description text check (char_length(description) <= 1000),
  servings smallint not null default 2 check (servings between 1 and 20),
  prep_minutes smallint check (prep_minutes between 0 and 1440),
  cook_minutes smallint check (cook_minutes between 0 and 1440),
  -- [{ "name": "onion", "quantity": "1 large", "category": "produce" }]
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  steps text[] not null default '{}',
  tags text[] not null default '{}',
  calories_per_serving integer check (calories_per_serving between 0 and 5000),
  protein_g numeric(6, 1),
  carbs_g numeric(6, 1),
  fat_g numeric(6, 1),
  source_url text check (char_length(source_url) <= 500),
  ai_generated boolean not null default false,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_household_idx on public.recipes (household_id, favorite desc, updated_at desc);
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

alter table public.food_entries
  add constraint food_entries_recipe_fk foreign key (recipe_id) references public.recipes (id) on delete set null;

create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  plan_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references public.recipes (id) on delete cascade,
  title text check (char_length(title) <= 150),
  servings smallint not null default 2 check (servings between 1 and 20),
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  check (recipe_id is not null or title is not null)
);
create index meal_plan_household_idx on public.meal_plan (household_id, plan_date);

-- ----------------------------------------- lab results (medical records) --
create table public.lab_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  document_id uuid references public.medical_documents (id) on delete set null,
  test_date date not null,
  panel text check (char_length(panel) <= 100),
  marker text not null check (char_length(marker) between 1 and 120),
  value numeric,
  value_text text check (char_length(value_text) <= 120),
  unit text check (char_length(unit) <= 40),
  ref_low numeric,
  ref_high numeric,
  ref_text text check (char_length(ref_text) <= 120),
  flag text check (flag in ('low', 'normal', 'high', 'abnormal')),
  source text not null default 'manual' check (source in ('manual', 'ai_extracted')),
  include_in_ai boolean not null default true,
  created_at timestamptz not null default now(),
  check (value is not null or value_text is not null)
);
create index lab_results_owner_idx on public.lab_results (owner_id, marker, test_date desc);

-- ------------------------------------------------------------------- RLS --
alter table public.nutrition_goals enable row level security;
alter table public.food_entries enable row level security;
alter table public.body_metrics enable row level security;
alter table public.body_goals enable row level security;
alter table public.pantry_items enable row level security;
alter table public.recipes enable row level security;
alter table public.meal_plan enable row level security;
alter table public.lab_results enable row level security;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('nutrition_goals', 'food_diary'),
      ('food_entries', 'food_diary'),
      ('body_metrics', 'body_recomp'),
      ('body_goals', 'body_recomp'),
      ('lab_results', 'medical_records')
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
      t.tbl);
  end loop;

  for t in select unnest(array['pantry_items', 'recipes', 'meal_plan']) as tbl
  loop
    execute format('create policy "%1$s: members read" on public.%1$I for select to authenticated using (public.is_household_member(household_id))', t.tbl);
    execute format('create policy "%1$s: members insert" on public.%1$I for insert to authenticated with check (public.is_household_member(household_id))', t.tbl);
    execute format('create policy "%1$s: members update" on public.%1$I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t.tbl);
    execute format('create policy "%1$s: members delete" on public.%1$I for delete to authenticated using (public.is_household_member(household_id))', t.tbl);
  end loop;
end $$;

-- A food entry may only reference a recipe from the same household.
create or replace function public.food_entry_recipe_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recipe_id is not null and not exists (
    select 1 from public.recipes r where r.id = new.recipe_id and r.household_id = new.household_id
  ) then
    raise exception 'recipe not found in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger food_entries_recipe_check before insert or update on public.food_entries
  for each row execute function public.food_entry_recipe_check();

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
    'food_diary', 'body_recomp', 'pantry', 'recipes'
  ]) as k;

  update public.profiles set active_household_id = hid where id = auth.uid();
  return hid;
end;
$$;

insert into public.household_modules (household_id, module_key, enabled)
select h.id, k, true
from public.households h
cross join unnest(array['food_diary', 'body_recomp', 'pantry', 'recipes']) as k
on conflict (household_id, module_key) do nothing;

-- More report types for medical documents (blood work, ECG, check-ups…).
alter table public.medical_documents drop constraint medical_documents_doc_type_check;
alter table public.medical_documents add constraint medical_documents_doc_type_check check (doc_type in (
  'discharge_summary', 'prescription', 'lab_report', 'imaging', 'consultation', 'vaccination', 'insurance',
  'ecg', 'health_checkup', 'pathology', 'dental', 'eye', 'other'
));

-- ============================================================
-- 20261104000001_phase3.sql
-- ============================================================

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

-- ============================================================
-- 20261105000001_phase4.sql
-- ============================================================

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

-- ============================================================
-- 20261106000001_menus.sql
-- ============================================================

-- Restaurant menus: richer dish records (imported from menu screenshots or
-- text) and logging a restaurant dish to the food diary.

alter table public.dining_dishes
  add column section text check (char_length(section) <= 80),
  add column description text check (char_length(description) <= 300),
  add column carbs_g numeric(6, 1) check (carbs_g between 0 and 1000),
  add column fat_g numeric(6, 1) check (fat_g between 0 and 500),
  add column nutrition_estimated boolean not null default true,
  add column source text not null default 'manual' check (source in ('manual', 'menu_import'));

-- Re-importing a menu updates dishes instead of duplicating them.
create unique index dining_dishes_place_name_idx on public.dining_dishes (place_id, lower(name));

-- Food diary entries can come from a saved restaurant dish.
alter table public.food_entries drop constraint food_entries_source_check;
alter table public.food_entries add constraint food_entries_source_check
  check (source in ('manual', 'ai_estimate', 'recipe', 'photo', 'restaurant'));
alter table public.food_entries
  add column dish_id uuid references public.dining_dishes (id) on delete set null;

-- A food entry may only reference a dish from the same household.
create or replace function public.food_entry_dish_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.dish_id is not null and not exists (
    select 1 from public.dining_dishes d where d.id = new.dish_id and d.household_id = new.household_id
  ) then
    raise exception 'dish not found in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger food_entries_dish_check before insert or update on public.food_entries
  for each row execute function public.food_entry_dish_check();

-- ============================================================
-- 20261107000001_nutrition.sql
-- ============================================================

-- Accurate nutrition: household foods (own/packaged foods per 100 g),
-- ingredient-level recipe nutrition, micronutrients on food entries,
-- shared-meal logging, bladder-irritant tags and leftovers in the pantry.

-- Foods the household saves: packaged products (barcode / label scan),
-- homemade staples, or USDA picks. Nutrients are per 100 g (or 100 ml).
create table public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  brand text check (char_length(brand) <= 80),
  barcode text check (barcode ~ '^[0-9]{6,14}$'),
  source text not null default 'manual' check (source in ('manual', 'label', 'openfoodfacts', 'usda')),
  serving_g numeric(7, 1) check (serving_g > 0 and serving_g <= 5000),
  serving_label text check (char_length(serving_label) <= 40),
  -- { "calories": 120, "protein_g": 3.1, "iron_mg": 1.2, ... } per 100 g
  nutrients jsonb not null default '{}'::jsonb check (jsonb_typeof(nutrients) = 'object'),
  irritants text[] not null default '{}',
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index custom_foods_barcode_idx on public.custom_foods (household_id, barcode) where barcode is not null;
create index custom_foods_name_idx on public.custom_foods (household_id, lower(name));
create trigger custom_foods_updated_at before update on public.custom_foods
  for each row execute function public.set_updated_at();

alter table public.custom_foods enable row level security;
create policy "custom_foods: members read" on public.custom_foods for select to authenticated using (public.is_household_member(household_id));
create policy "custom_foods: members insert" on public.custom_foods for insert to authenticated with check (public.is_household_member(household_id));
create policy "custom_foods: members update" on public.custom_foods for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "custom_foods: members delete" on public.custom_foods for delete to authenticated using (public.is_household_member(household_id));

-- Recipes: per-serving nutrition calculated from ingredients (grams × food data),
-- cooked weight so a portion can be logged by grams / katori.
alter table public.recipes
  add column nutrition jsonb check (nutrition is null or jsonb_typeof(nutrition) = 'object'),
  add column total_weight_g numeric(8, 1) check (total_weight_g > 0 and total_weight_g <= 50000),
  add column irritants text[] not null default '{}';

-- Food entries: micronutrients, weight eaten, how the numbers were obtained,
-- bladder-irritant tags and a group id when one meal is logged for several people.
alter table public.food_entries
  add column micros jsonb not null default '{}'::jsonb check (jsonb_typeof(micros) = 'object'),
  add column grams numeric(7, 1) check (grams > 0 and grams <= 10000),
  add column accuracy text not null default 'estimated' check (accuracy in ('calculated', 'label', 'estimated')),
  add column irritants text[] not null default '{}',
  add column group_id uuid;
create index food_entries_group_idx on public.food_entries (group_id) where group_id is not null;

-- Leftovers: pantry items can point at the recipe they came from and count portions.
alter table public.pantry_items
  add column recipe_id uuid references public.recipes (id) on delete set null,
  add column portions numeric(5, 2) check (portions >= 0 and portions <= 100);

create or replace function public.pantry_recipe_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recipe_id is not null and not exists (
    select 1 from public.recipes r where r.id = new.recipe_id and r.household_id = new.household_id
  ) then
    raise exception 'recipe not found in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger pantry_items_recipe_check before insert or update on public.pantry_items
  for each row execute function public.pantry_recipe_check();

-- ============================================================
-- 20261108000001_water.sql
-- ============================================================

-- Water reminders: per-person settings on notification preferences.
alter table public.notification_prefs
  add column water boolean not null default false,
  add column water_target_ml integer check (water_target_ml between 500 and 6000),
  add column water_interval_min smallint not null default 120 check (water_interval_min between 30 and 360),
  add column water_start time not null default '08:00',
  -- Last reminder of the day; default stops in the evening so drinking late
  -- doesn't add night-time bathroom trips or leaks.
  add column water_end time not null default '19:30';

-- ============================================================
-- 20261109000001_language.sql
-- ============================================================

-- App language per person: English, Hindi or Marathi. Also used for AI
-- replies and notification text.
alter table public.profiles
  add column language text not null default 'en' check (language in ('en', 'hi', 'mr'));

-- ============================================================
-- 20261110000001_engagement.sql
-- ============================================================

-- Engagement: Home view choice, "close your day" reminder, partner cheers,
-- milestones (celebrated once) and a privacy-safe activity calendar for streaks.

alter table public.profiles
  add column home_view text not null default 'arc' check (home_view in ('arc', 'bars', 'tiles'));

alter table public.notification_prefs
  add column close_day boolean not null default true,
  add column close_day_time time not null default '21:00',
  add column partner_updates boolean not null default true;

-- Cheers between household members (👏 ❤️ 💪 🎉).
create table public.cheers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  from_user uuid not null default auth.uid() references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('👏', '❤️', '💪', '🎉')),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index cheers_to_idx on public.cheers (to_user, created_at desc);
create index cheers_from_idx on public.cheers (from_user, created_at desc);
alter table public.cheers enable row level security;
create policy "cheers: send to household members" on public.cheers for insert to authenticated
  with check (from_user = auth.uid() and public.is_household_member(household_id) and public.shares_household(to_user)
    and exists (select 1 from public.household_members m where m.household_id = cheers.household_id and m.user_id = cheers.to_user));
create policy "cheers: sender or recipient reads" on public.cheers for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- Milestones reached (so each is celebrated once).
create table public.milestones (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_.:-]{1,60}$'),
  achieved_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.milestones enable row level security;
create policy "milestones: own rows" on public.milestones for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Days (in the person's own timezone) on which anything was logged.
-- Yourself, or a household member: only the dates are revealed, never what
-- was logged, so streaks can be shown without sharing any module.
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

-- ============================================================
-- 20261111000001_ai_model.sql
-- ============================================================

-- Household AI model choice: standard (Flash: faster, more free requests)
-- or best (Pro: smarter, slower, fewer free requests).
alter table public.households
  add column ai_model text not null default 'standard' check (ai_model in ('standard', 'best'));

-- ============================================================
-- 20261112000001_meal_other.sql
-- ============================================================

-- A fifth meal: "other" (misc: drinks or bites outside the usual meals).
alter table public.food_entries drop constraint if exists food_entries_meal_check;
alter table public.food_entries add constraint food_entries_meal_check check (meal in ('breakfast', 'lunch', 'dinner', 'snack', 'other'));
alter table public.meal_plan drop constraint if exists meal_plan_meal_check;
alter table public.meal_plan add constraint meal_plan_meal_check check (meal in ('breakfast', 'lunch', 'dinner', 'snack', 'other'));

-- ============================================================
-- 20261113000001_accept_invite_rejoin.sql
-- ============================================================

-- Joining with an invite you already used (e.g. the page failed after the join
-- went through) now just takes you to that household instead of failing with
-- "invite already used". Someone else using the same invite still fails.
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

-- ============================================================
-- 20261114000001_supplements_pantry.sql
-- ============================================================

-- Supplement nutrients (per dose, counted on days they're ticked), pantry
-- "running low" and staples, and grocery items linked back to the pantry.

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

-- ============================================================
-- 20261115000001_week_plan.sql
-- ============================================================

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
