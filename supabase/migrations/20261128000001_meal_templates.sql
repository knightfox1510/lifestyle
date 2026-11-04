-- Saved meals ("our usual breakfast"): a household's list of foods with their
-- numbers, added to anyone's diary in one tap with a portion per person.
create table if not exists public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  meal text check (meal in ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  uses integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists meal_templates_household_idx on public.meal_templates (household_id, last_used_at desc nulls last);

alter table public.meal_templates enable row level security;
drop policy if exists "meal_templates: members read" on public.meal_templates;
create policy "meal_templates: members read" on public.meal_templates for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "meal_templates: members insert" on public.meal_templates;
create policy "meal_templates: members insert" on public.meal_templates for insert to authenticated with check (public.is_household_member(household_id));
drop policy if exists "meal_templates: members update" on public.meal_templates;
create policy "meal_templates: members update" on public.meal_templates for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists "meal_templates: members delete" on public.meal_templates;
create policy "meal_templates: members delete" on public.meal_templates for delete to authenticated using (public.is_household_member(household_id));
