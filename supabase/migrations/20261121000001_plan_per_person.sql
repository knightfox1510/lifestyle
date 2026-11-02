-- Week plan per person: a dish can be for one member only, each person has
-- their own portion, dishes carry per-serving macros and an ingredient list
-- (for the grocery list), and we remember when a planned meal was logged.
alter table public.meal_plan
  add column if not exists for_user uuid references auth.users (id) on delete cascade,
  add column if not exists portions jsonb not null default '{}'::jsonb,
  add column if not exists kcal_per_serving integer,
  add column if not exists protein_g numeric(6, 1),
  add column if not exists carbs_g numeric(6, 1),
  add column if not exists fat_g numeric(6, 1),
  add column if not exists ingredients jsonb not null default '[]'::jsonb,
  add column if not exists logged_at timestamptz;
do $$ begin
  alter table public.meal_plan add constraint meal_plan_portions_object check (jsonb_typeof(portions) = 'object');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.meal_plan add constraint meal_plan_ingredients_array check (jsonb_typeof(ingredients) = 'array');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.meal_plan add constraint meal_plan_kcal_range check (kcal_per_serving between 0 and 5000);
exception when duplicate_object then null; end $$;

-- A dish "just for" someone must be for a member of the same household.
create or replace function public.meal_plan_member_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.for_user is not null and not exists (
    select 1 from public.household_members m where m.household_id = new.household_id and m.user_id = new.for_user
  ) then
    raise exception 'that person is not in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists meal_plan_member_check on public.meal_plan;
create trigger meal_plan_member_check before insert or update on public.meal_plan
  for each row execute function public.meal_plan_member_check();
