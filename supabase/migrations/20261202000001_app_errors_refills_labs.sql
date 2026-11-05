-- Problems the app ran into (server and browser), so they can be spotted
-- and fixed without waiting for a report. Only the error message, the page
-- path (no query string or form data), time and browser: no health data.
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  source text not null check (source in ('server', 'client')),
  path text check (char_length(path) <= 300),
  message text not null check (char_length(message) <= 500),
  digest text check (char_length(digest) <= 100),
  stack text check (char_length(stack) <= 2000),
  user_agent text check (char_length(user_agent) <= 300)
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
alter table public.app_errors enable row level security;
-- Written by the server only (service role); you can read your own.
drop policy if exists "app_errors: read own" on public.app_errors;
create policy "app_errors: read own" on public.app_errors for select to authenticated using (user_id = auth.uid());
