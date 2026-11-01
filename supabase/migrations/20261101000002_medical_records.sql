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
