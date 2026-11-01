-- A fifth meal: "other" (misc: drinks or bites outside the usual meals).
alter table public.food_entries drop constraint if exists food_entries_meal_check;
alter table public.food_entries add constraint food_entries_meal_check check (meal in ('breakfast', 'lunch', 'dinner', 'snack', 'other'));
alter table public.meal_plan drop constraint if exists meal_plan_meal_check;
alter table public.meal_plan add constraint meal_plan_meal_check check (meal in ('breakfast', 'lunch', 'dinner', 'snack', 'other'));
