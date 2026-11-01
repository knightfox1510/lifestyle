-- Restaurant menus: richer dish records (imported from menu screenshots or
-- text) and logging a restaurant dish to the food diary.

alter table public.dining_dishes
  add column section text check (char_length(section) <= 80),
  add column description text check (char_length(description) <= 300),
  add column carbs_g numeric(6, 1) check (carbs_g between 0 and 1000),
  add column fat_g numeric(6, 1) check (fat_g between 0 and 500),
  add column nutrition_estimated boolean not null default true,
  add column source text not null default 'manual' check (source in ('manual', 'menu_import'));

-- Re-importing a menu updates dishes instead of duplicating them.
create unique index dining_dishes_place_name_idx on public.dining_dishes (place_id, lower(name));

-- Food diary entries can come from a saved restaurant dish.
alter table public.food_entries drop constraint food_entries_source_check;
alter table public.food_entries add constraint food_entries_source_check
  check (source in ('manual', 'ai_estimate', 'recipe', 'photo', 'restaurant'));
alter table public.food_entries
  add column dish_id uuid references public.dining_dishes (id) on delete set null;

-- A food entry may only reference a dish from the same household.
create or replace function public.food_entry_dish_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.dish_id is not null and not exists (
    select 1 from public.dining_dishes d where d.id = new.dish_id and d.household_id = new.household_id
  ) then
    raise exception 'dish not found in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger food_entries_dish_check before insert or update on public.food_entries
  for each row execute function public.food_entry_dish_check();
