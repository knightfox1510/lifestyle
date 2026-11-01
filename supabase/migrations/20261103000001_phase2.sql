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
