-- Household AI model choice: standard (Flash: faster, more free requests)
-- or best (Pro: smarter, slower, fewer free requests).
alter table public.households
  add column ai_model text not null default 'standard' check (ai_model in ('standard', 'best'));
