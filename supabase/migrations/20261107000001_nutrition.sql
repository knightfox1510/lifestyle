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
