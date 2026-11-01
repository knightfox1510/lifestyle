-- Supplement nutrients (per dose, counted on days they're ticked), pantry
-- "running low" and staples, and grocery items linked back to the pantry.

alter table public.supplements
  add column if not exists nutrients jsonb not null default '{}'::jsonb,
  add column if not exists serving_label text,
  add column if not exists nutrients_source text;
do $$ begin
  alter table public.supplements add constraint supplements_nutrients_object check (jsonb_typeof(nutrients) = 'object');
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.supplements add constraint supplements_serving_label_len check (char_length(serving_label) <= 40);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.supplements add constraint supplements_nutrients_source_check check (nutrients_source in ('manual', 'label', 'catalog'));
exception when duplicate_object then null;
end $$;

alter table public.pantry_items
  add column if not exists staple boolean not null default false,
  add column if not exists running_low boolean not null default false;

alter table public.grocery_items
  add column if not exists reason text,
  add column if not exists pantry_item_id uuid references public.pantry_items (id) on delete set null;
do $$ begin
  alter table public.grocery_items add constraint grocery_items_reason_check check (reason in ('used_up', 'running_low', 'staple'));
exception when duplicate_object then null;
end $$;

-- A grocery item can only point at a pantry item of the same household.
create or replace function public.grocery_pantry_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pantry_item_id is not null and not exists (
    select 1 from public.pantry_items p where p.id = new.pantry_item_id and p.household_id = new.household_id
  ) then
    raise exception 'pantry item not found in this household' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists grocery_items_pantry_check on public.grocery_items;
create trigger grocery_items_pantry_check before insert or update on public.grocery_items
  for each row execute function public.grocery_pantry_check();
