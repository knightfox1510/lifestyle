-- AI spend: log everything Google bills (hidden thinking, cached input, web
-- searches, model, retries), and keep answers to repeated requests (the same
-- meal typed again) so they don't cost another AI call.

alter table public.ai_usage add column if not exists thinking_tokens integer;
alter table public.ai_usage add column if not exists cached_tokens integer;
alter table public.ai_usage add column if not exists search_queries smallint;
alter table public.ai_usage add column if not exists model text check (char_length(model) <= 80);
alter table public.ai_usage add column if not exists attempts smallint not null default 1;
-- Answered from the cache: free, and not counted toward the daily limit.
alter table public.ai_usage add column if not exists from_cache boolean not null default false;

create table if not exists public.ai_cache (
  household_id uuid not null references public.households (id) on delete cascade,
  -- SHA-256 of the feature and the request (never a photo).
  key text not null check (char_length(key) = 64),
  feature text not null check (char_length(feature) <= 60),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (household_id, key)
);
create index if not exists ai_cache_created_idx on public.ai_cache (created_at);

alter table public.ai_cache enable row level security;
drop policy if exists "ai_cache: members read" on public.ai_cache;
create policy "ai_cache: members read" on public.ai_cache for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "ai_cache: members insert" on public.ai_cache;
create policy "ai_cache: members insert" on public.ai_cache for insert to authenticated with check (public.is_household_member(household_id));
drop policy if exists "ai_cache: members update" on public.ai_cache;
create policy "ai_cache: members update" on public.ai_cache for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists "ai_cache: members delete" on public.ai_cache;
create policy "ai_cache: members delete" on public.ai_cache for delete to authenticated using (public.is_household_member(household_id));
