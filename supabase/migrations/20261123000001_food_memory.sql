-- Remembered food matches: when you log an ingredient with a match you've
-- seen (or fixed), the same name uses the same food data next time, so
-- "pink guava" is always the same 68 kcal/100 g and never re-guessed.
create table if not exists public.food_aliases (
  household_id uuid not null references public.households (id) on delete cascade,
  name_key text not null check (char_length(name_key) between 1 and 80),
  label text not null check (char_length(label) between 1 and 200),
  ref jsonb not null check (jsonb_typeof(ref) = 'object'),
  per100 jsonb not null check (jsonb_typeof(per100) = 'object'),
  source text check (char_length(source) <= 40),
  confirmed boolean not null default false,
  uses integer not null default 1,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (household_id, name_key)
);

alter table public.food_aliases enable row level security;
drop policy if exists "food_aliases: members read" on public.food_aliases;
create policy "food_aliases: members read" on public.food_aliases for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "food_aliases: members insert" on public.food_aliases;
create policy "food_aliases: members insert" on public.food_aliases for insert to authenticated with check (public.is_household_member(household_id));
drop policy if exists "food_aliases: members update" on public.food_aliases;
create policy "food_aliases: members update" on public.food_aliases for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists "food_aliases: members delete" on public.food_aliases;
create policy "food_aliases: members delete" on public.food_aliases for delete to authenticated using (public.is_household_member(household_id));
