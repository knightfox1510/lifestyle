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
